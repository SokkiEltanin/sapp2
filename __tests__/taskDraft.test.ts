jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { useTaskDraftStore, isDraftEmpty } from '@/store/taskDraftStore';

describe('kopia robocza zadania', () => {
  const base = { title: '', tag: '', deadlineChoice: 'none', custom: null, customHasTime: false, steps: [] };
  test('pusty formularz nie tworzy szkicu, wpisany tytuł tak', () => {
    const st = useTaskDraftStore.getState();
    st.save('new', base);
    expect(useTaskDraftStore.getState().drafts.new).toBeUndefined();
    st.save('new', { ...base, title: 'Kupić mleko' });
    expect(useTaskDraftStore.getState().drafts.new?.title).toBe('Kupić mleko');
    st.save('new', base); // wyczyszczony formularz kasuje szkic
    expect(useTaskDraftStore.getState().drafts.new).toBeUndefined();
  });
  test('szkic edycji osobno od nowego; clear', () => {
    const st = useTaskDraftStore.getState();
    st.save('t1', { ...base, title: 'Zmiana' });
    st.save('new', { ...base, tag: 'UR' });
    expect(Object.keys(useTaskDraftStore.getState().drafts).sort()).toEqual(['new', 't1']);
    st.clear('t1');
    expect(useTaskDraftStore.getState().drafts.t1).toBeUndefined();
    expect(isDraftEmpty({ title: ' ', tag: '', steps: [] })).toBe(true);
  });
});
