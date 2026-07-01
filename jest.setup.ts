import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Browser API stubs for jsdom
// ---------------------------------------------------------------------------

// scrollIntoView
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = jest.fn();
}

// Web Audio API
const AudioContextMock = jest.fn().mockImplementation(() => ({
  createMediaStreamSource: jest.fn().mockReturnValue({ connect: jest.fn() }),
  createAnalyser: jest.fn().mockReturnValue({ connect: jest.fn(), fftSize: 256, getByteFrequencyData: jest.fn() }),
  createScriptProcessor: jest.fn().mockReturnValue({ connect: jest.fn(), disconnect: jest.fn(), onaudioprocess: null }),
  destination: {},
  sampleRate: 44100,
  close: jest.fn(),
  state: 'running',
}));
(global as any).AudioContext = AudioContextMock;
(global as any).AudioCtx = AudioContextMock;
(global as any).webkitAudioContext = AudioContextMock;

// MediaSource
(global as any).MediaSource = jest.fn().mockImplementation(() => ({
  addSourceBuffer: jest.fn().mockReturnValue({ appendBuffer: jest.fn(), updating: false }),
  endOfStream: jest.fn(),
  readyState: 'open',
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// MediaRecorder
(global as any).MediaRecorder = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  state: 'inactive',
  ondataavailable: null,
  onstop: null,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// MediaDevices / getUserMedia
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }]),
    }),
  },
  writable: true,
});

// WebSocket
(global as any).WebSocket = jest.fn().mockImplementation(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1,
  OPEN: 1,
}));

// URL.createObjectURL
(global as any).URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
(global as any).URL.revokeObjectURL = jest.fn();
