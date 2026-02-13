import { Bar } from '../models/Bar';

export type { Bar };

export const dummyBars: Bar[] = [
  {
    id: '1',
    name: "Bar Sport 'El Camp Nou'",
    latitude: 41.380896,
    longitude: 2.122820,
    address: 'Carrer de Aristides Maillol, 12, Barcelona',
    rating: 4.5,
    isOpen: true,
    image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1000&auto=format&fit=crop',
    tags: ['Terrassa', 'Projector', 'Wifi']
  },
  {
    id: '2',
    name: "La Cerveseria del Barri",
    latitude: 41.382500,
    longitude: 2.125000,
    address: 'Av. Diagonal, 600, Barcelona',
    rating: 4.2,
    isOpen: false,
    image: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?q=80&w=1000&auto=format&fit=crop',
    tags: ['Cervesa Artesana', 'Futbolí'],
  },
  {
    id: '3',
    name: "The Irish Rover",
    latitude: 41.385000,
    longitude: 2.120000,
    address: 'Carrer de Sants, 100, Barcelona',
    rating: 4.8,
    isOpen: true,
    image: 'https://images.unsplash.com/photo-1575444758702-4a6b9222336e?q=80&w=1000&auto=format&fit=crop',
    tags: ['TV Gegant', 'Guinness', 'Obert ara']
  }
];
