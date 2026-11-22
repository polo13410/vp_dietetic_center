import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutosave } from './useAutosave';

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('saves the last value once typing pauses', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(save, 500));

    act(() => {
      result.current.schedule('a');
      result.current.schedule('ab');
    });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('ab');
    expect(result.current.state.status).toBe('saved');
    expect(result.current.state.savedAt).toBeInstanceOf(Date);
  });

  it('saves at once on flush (leaving the field)', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(save, 500));
    act(() => result.current.schedule('x'));
    await act(async () => {
      await result.current.flush();
    });
    expect(save).toHaveBeenCalledWith('x');
  });

  it('reports a failed save', async () => {
    const save = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAutosave(save, 10));
    act(() => result.current.schedule('x'));
    await act(async () => {
      await result.current.flush();
    });
    expect(result.current.state.status).toBe('error');
  });

  it('forgets a cancelled change', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave(save, 10));
    act(() => {
      result.current.schedule('x');
      result.current.cancel();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('saves a pending change when the field goes away', () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useAutosave(save, 500));
    act(() => result.current.schedule('last words'));
    unmount();
    return vi.waitFor(() => expect(save).toHaveBeenCalledWith('last words'));
  });
});
