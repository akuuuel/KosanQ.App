import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, getDocs, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Room } from '../types';

const ROOMS_COLLECTION = 'rooms';

export const addRoom = async (room: Omit<Room, 'id'>) => {
  return await addDoc(collection(db, ROOMS_COLLECTION), {
    ...room,
    createdAt: Date.now()
  });
};

export const updateRoom = async (id: string, data: Partial<Room>) => {
  const roomRef = doc(db, ROOMS_COLLECTION, id);
  const { id: _, ...rest } = data;
  await updateDoc(roomRef, {
    ...rest,
    updatedAt: Date.now()
  });
};

export const deleteRoom = async (id: string) => {
  const roomRef = doc(db, ROOMS_COLLECTION, id);
  await deleteDoc(roomRef);
};

export const listenRooms = (kostId: string, callback: (rooms: Room[]) => void) => {
  const q = query(collection(db, ROOMS_COLLECTION), where('kostId', '==', kostId));
  return onSnapshot(q, (snapshot) => {
    const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
    callback(rooms);
  });
};

export const getRoomsByKost = async (kostId: string) => {
  const q = query(collection(db, ROOMS_COLLECTION), where('kostId', '==', kostId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
};

export const getRoomById = async (id: string) => {
  const docRef = doc(db, ROOMS_COLLECTION, id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as Room;
  }
  return null;
};
