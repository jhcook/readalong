import { AudioRecorder } from './AudioRecorder';

describe('AudioRecorder', () => {
  let recorder: AudioRecorder;
  let mockMediaRecorder: any;
  let mockStream: any;

  beforeEach(() => {
    recorder = new AudioRecorder();

    mockStream = {
      getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
    };

    mockMediaRecorder = {
      start: jest.fn(),
      stop: jest.fn(),
      ondataavailable: null,
      onstop: null,
      state: 'inactive'
    };

    // Mock global navigator
    Object.defineProperty(global, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: jest.fn().mockResolvedValue(mockStream)
        }
      },
      writable: true
    });

    // Mock MediaRecorder constructor
    (global as any).MediaRecorder = jest.fn(() => mockMediaRecorder);
  });

  it('requests permission and starts recording', async () => {
    await recorder.prepare();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });

    recorder.startRecording();
    expect((global as any).MediaRecorder).toHaveBeenCalledWith(mockStream);
    expect(mockMediaRecorder.start).toHaveBeenCalled();
  });

  it('stops recording and returns blob', async () => {
    await recorder.prepare();
    recorder.startRecording();

    const stopPromise = recorder.stop();

    // Simulate MediaRecorder behavior
    if (mockMediaRecorder.onstop) {
      mockMediaRecorder.onstop();
    }

    const blob = await stopPromise;
    expect(blob).toBeInstanceOf(Blob);
    expect(mockMediaRecorder.stop).toHaveBeenCalled();
    expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
  });

  it('checks recording state', async () => {
    expect(recorder.isRecording()).toBe(false);

    mockMediaRecorder.state = 'recording';
    await recorder.prepare();
    recorder.startRecording();
    expect(recorder.isRecording()).toBe(true);
  });
});
