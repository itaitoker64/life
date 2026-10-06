import { create } from 'zustand';
import { loadDoc, saveDoc } from '../db/docs';
import { L } from '../strength/store';
import { emptyPlanning, type PlanningData } from './model';

export const usePlanning = create<{ data: PlanningData; ready: boolean }>(() => ({ data: emptyPlanning(), ready: false }));
let writes: Promise<void> = Promise.resolve();
export async function initPlanning() {
  await writes.catch(() => {});
  const saved = await loadDoc<PlanningData>('life_planning', 'settings');
  const data = saved ?? emptyPlanning();
  if (!saved) {
    data.sessions = (L.settings.scheduledWorkouts ?? []).map(s => ({
      id: `legacy:${s.date}:${s.routineId}`, date: s.date, kind: 'strength', routineId: s.routineId,
      title: L.routines.find(r => r.id === s.routineId)?.name ?? 'אימון כוח',
    }));
    await saveDoc('life_planning', 'settings', data);
  }
  usePlanning.setState({ data, ready: true });
}
/** Persist before notifying subscribers; serialize edits so concurrent saves cannot lose data. */
export function updatePlanning(change: (data: PlanningData) => PlanningData): Promise<void> {
  const operation = writes.catch(() => {}).then(async () => {
    const data = change(usePlanning.getState().data);
    await saveDoc('life_planning', 'settings', data);
    usePlanning.setState({ data });
  });
  writes = operation;
  return operation;
}
