export interface UserProfile {
    id: string;
    name: string;
    surname?: string;
    email: string;
    avatar?: string;
    favoriteTeam?: string;
    favoriteSport?: string;
    role?: 'user' | 'bar_owner' | 'admin';
    ownedBars?: string[]; // Array d'IDs de bars propietat d'aquest usuari
}
