/**
 * Development work by David Lane
 */
import { attachStudioRealtime, STUDIO_NS, studioSocketRoom } from '../../services/studio-socket.service.js';

describe('studio-socket.service', () => {
  test('studioSocketRoom sanitizes reel codes', () => {
    expect(studioSocketRoom('ab-12')).toBe('reel:AB12');
  });

  test('attachStudioRealtime binds the /studio namespace', () => {
    const connectionHandlers = [];
    const fakeNsp = {
      on(event, handler) {
        if (event === 'connection') connectionHandlers.push(handler);
      },
    };
    const io = {
      of(ns) {
        expect(ns).toBe(STUDIO_NS);
        return fakeNsp;
      },
    };
    const nsp = attachStudioRealtime(io);
    expect(nsp).toBe(fakeNsp);
    expect(connectionHandlers).toHaveLength(1);
  });

  test('join emits presence to the reel room', () => {
    const socketHandlers = {};
    const emitted = [];
    const fakeSocket = {
      id: 'sock-1',
      handlers: socketHandlers,
      joined: [],
      left: [],
      on(event, handler) {
        socketHandlers[event] = handler;
      },
      join(room) {
        this.joined.push(room);
      },
      leave(room) {
        this.left.push(room);
      },
      emit(event, payload) {
        emitted.push({ target: 'self', event, payload });
      },
      to() {
        return this;
      },
    };

    let connectionHandler;
    const roomEmits = [];
    const fakeNsp = {
      on(event, handler) {
        if (event === 'connection') connectionHandler = handler;
      },
      to(room) {
        return {
          emit(event, payload) {
            roomEmits.push({ room, event, payload });
          },
        };
      },
    };
    attachStudioRealtime({ of: () => fakeNsp });
    connectionHandler(fakeSocket);
    socketHandlers['studio:join']({ reelCode: 'zz9', name: 'Sam' });
    expect(fakeSocket.joined).toContain('reel:ZZ9');
    expect(emitted.some((row) => row.event === 'studio:joined')).toBe(true);
    expect(roomEmits.some((row) => row.event === 'studio:presence')).toBe(true);
  });
});
