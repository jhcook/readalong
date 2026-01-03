import { traceAsync } from '../utils/trace';
import { AudioCache } from '../AudioCache';
import { generateId } from '../utils/hash';

export async function handleResembleMessage(
    message: any,
    audioCache: AudioCache
): Promise<any> {
    if (message.type === 'FETCH_RESEMBLE_VOICES') {
        const { apiKey } = message;
        return traceAsync('Background.fetchResembleVoices', async (span) => {
            const res = await fetch('https://app.resemble.ai/api/v2/voices?page=1', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Resemble API Error: ${res.status} ${errorText}`);
            }

            const data = await res.json();
            const voices = data.items || [];

            // Fetch projects to find "ReadAlong" or create it
            let defaultProjectUuid = '';
            try {
                const projRes = await fetch('https://app.resemble.ai/api/v2/projects?page=1', {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                // Helper to find project
                const findReadAlongProject = (items: any[]) => items.find((p: any) => p.name === 'ReadAlong');

                if (projRes.ok) {
                    const projData = await projRes.json();
                    const projects = projData.items || [];

                    // 1. Try to find "ReadAlong"
                    let targetProject = findReadAlongProject(projects);

                    // 2. If not found, create it
                    if (!targetProject) {
                        console.log('[Background] "ReadAlong" project not found in Resemble. Creating...');
                        const createRes = await fetch('https://app.resemble.ai/api/v2/projects', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                name: 'ReadAlong',
                                description: 'Automatically created by ReadAlong extension for audio generation',
                                is_public: false,
                                is_collaborative: false,
                                is_archived: false
                            })
                        });

                        if (createRes.ok) {
                            const createData = await createRes.json();
                            targetProject = createData.item || createData;
                            console.log('[Background] Created "ReadAlong" project:', targetProject?.uuid);
                        } else {
                            console.warn('[Background] Failed to create "ReadAlong" project', await createRes.text());
                        }
                    }

                    // 3. Set UUID
                    if (targetProject && targetProject.uuid) {
                        defaultProjectUuid = targetProject.uuid;
                    } else if (projects.length > 0) {
                        // Fallback to first project if creation failed
                        defaultProjectUuid = projects[0].uuid;
                    }
                }
            } catch (e) {
                console.warn("Failed to manage projects", e);
            }

            // Map voices
            const mappedVoices = voices.map((v: any) => ({
                uuid: v.uuid,
                name: v.name,
                project_uuid: defaultProjectUuid, // Auto-assigned project UUID
                preview_url: v.preview_url
            }));

            return { success: true, voices: mappedVoices };
        });
    }

    if (message.type === 'GENERATE_RESEMBLE_AUDIO') {
        const { text, voiceUuid, projectUuid, apiKey } = message;

        return traceAsync('Background.generateResembleAudio', async (span) => {
            span.setAttribute('resemble.voice_uuid', voiceUuid);

            // Generate ID based on text + voice
            const id = await generateId(voiceUuid, text);

            // Check Cache
            const cachedData = await audioCache.getAudio(id);
            if (cachedData) {
                console.log('Background: Resemble Cache hit for', id);
                span.addEvent('cache_hit');
                return { success: true, audioId: id, alignment: cachedData.alignment };
            }

            span.addEvent('cache_miss');

            // Generate Clip
            console.log('Background: Generating Resemble Clip...');
            if (!projectUuid) throw new Error("Project UUID required for Resemble Audio");

            const resp = await fetch(`https://app.resemble.ai/api/v2/projects/${projectUuid}/clips`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: 'ReadAlong-Clip',
                    body: text,
                    voice_uuid: voiceUuid,
                    is_public: false,
                    is_archived: false,
                    include_timestamps: true
                })
            });

            if (!resp.ok) {
                const errorText = await resp.text();
                let errMsg = `Resemble API Error: ${resp.status} ${errorText}`;

                if (resp.status === 401) {
                    errMsg = "ERR_UNAUTHORIZED: Invalid Resemble API Key.";
                } else if (resp.status === 402) {
                    errMsg = "ERR_PAYMENT_REQUIRED: Resemble AI quota exceeded or payment required.";
                } else if (resp.status === 429) {
                    errMsg = "ERR_TOO_MANY_REQUESTS: Resemble AI rate limit exceeded.";
                }

                throw new Error(errMsg);
            }

            const data = await resp.json();
            const item = data.item;
            if (!item || !item.audio_src) throw new Error('No audio_src in response');

            // Download Audio
            const audioSrc = item.audio_src;
            const audioResp = await fetch(audioSrc);
            if (!audioResp.ok) throw new Error("Failed to download generated audio from Resemble");
            const audioBlob = await audioResp.blob();

            // Get Timestamps
            const timestamps = item.timestamps;

            // Cache it
            await audioCache.saveAudio(id, audioBlob, timestamps);

            // Cleanup: Delete the clip from Resemble to avoid clutter
            if (projectUuid && item.uuid) {
                fetch(`https://app.resemble.ai/api/v2/projects/${projectUuid}/clips/${item.uuid}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }).then(delRes => {
                    if (delRes.ok) console.log('[Background] Cleaned up Resemble clip:', item.uuid);
                    else console.warn('[Background] Failed to cleanup Resemble clip:', item.uuid);
                }).catch(e => console.warn('[Background] Error cleaning up Resemble clip:', e));
            }

            return { success: true, audioId: id, alignment: timestamps };
        });
    }

    return null;
}
