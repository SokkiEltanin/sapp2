import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Vehicle, VehicleMaintenance, FuelLog, OdometerReading } from '@/types/vehicles';

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

interface VehiclesState {
  vehicles: Vehicle[];

  addVehicle: (input: Omit<Vehicle, 'id' | 'maintenance' | 'fuelLog' | 'odometerLog' | 'createdAt' | 'updatedAt'>) => Vehicle;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;
  setMainCar: (id: string) => void;

  addMaintenance: (vehicleId: string, entry: Omit<VehicleMaintenance, 'id'>) => void;
  deleteMaintenance: (vehicleId: string, entryId: string) => void;

  addFuelLog: (vehicleId: string, entry: Omit<FuelLog, 'id'>) => FuelLog;
  deleteFuelLog: (vehicleId: string, entryId: string) => void;

  addOdometerReading: (vehicleId: string, entry: Omit<OdometerReading, 'id'>) => void;
  deleteOdometerReading: (vehicleId: string, entryId: string) => void;
}

// Offline-first AsyncStorage, ten sam wzorzec co workStore.ts/moodStore.ts — bez
// Firestore sync.
export const useVehiclesStore = create<VehiclesState>()(
  persist(
    (set, get) => ({
      vehicles: [],

      addVehicle: (input) => {
        const now = Date.now();
        const v: Vehicle = { ...input, id: genId('veh'), maintenance: [], fuelLog: [], odometerLog: [], createdAt: now, updatedAt: now };
        set({ vehicles: [...get().vehicles, v] });
        return v;
      },
      updateVehicle: (id, patch) => set((s) => ({
        vehicles: s.vehicles.map((v) => (v.id === id ? { ...v, ...patch, updatedAt: Date.now() } : v)),
      })),
      deleteVehicle: (id) => set((s) => ({ vehicles: s.vehicles.filter((v) => v.id !== id) })),
      // Tylko JEDEN samochód może być głównym (łapie generyczne "wygląda jak paliwo"
      // wydatki, patrz utils/vehicleMatch.ts's mainCarId) — ustawienie nowego czyści
      // flagę ze wszystkich pozostałych.
      setMainCar: (id) => set((s) => ({
        vehicles: s.vehicles.map((v) => ({ ...v, isMainCar: v.id === id, updatedAt: v.id === id || v.isMainCar ? Date.now() : v.updatedAt })),
      })),

      addMaintenance: (vehicleId, entry) => set((s) => ({
        vehicles: s.vehicles.map((v) => (v.id === vehicleId
          ? { ...v, maintenance: [{ ...entry, id: genId('mnt') }, ...v.maintenance], updatedAt: Date.now() }
          : v)),
      })),
      deleteMaintenance: (vehicleId, entryId) => set((s) => ({
        vehicles: s.vehicles.map((v) => (v.id === vehicleId
          ? { ...v, maintenance: v.maintenance.filter((m) => m.id !== entryId), updatedAt: Date.now() }
          : v)),
      })),

      addFuelLog: (vehicleId, entry) => {
        const log: FuelLog = { ...entry, id: genId('fuel') };
        set((s) => ({
          vehicles: s.vehicles.map((v) => (v.id === vehicleId
            ? { ...v, fuelLog: [log, ...v.fuelLog], updatedAt: Date.now() }
            : v)),
        }));
        return log;
      },
      deleteFuelLog: (vehicleId, entryId) => set((s) => ({
        vehicles: s.vehicles.map((v) => (v.id === vehicleId
          ? { ...v, fuelLog: v.fuelLog.filter((f) => f.id !== entryId), updatedAt: Date.now() }
          : v)),
      })),

      addOdometerReading: (vehicleId, entry) => set((s) => ({
        vehicles: s.vehicles.map((v) => (v.id === vehicleId
          ? { ...v, odometerLog: [{ ...entry, id: genId('odo') }, ...v.odometerLog], updatedAt: Date.now() }
          : v)),
      })),
      deleteOdometerReading: (vehicleId, entryId) => set((s) => ({
        vehicles: s.vehicles.map((v) => (v.id === vehicleId
          ? { ...v, odometerLog: v.odometerLog.filter((o) => o.id !== entryId), updatedAt: Date.now() }
          : v)),
      })),
    }),
    { name: 'vehicles-storage', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
