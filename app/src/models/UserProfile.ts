export interface UserProfile {
    id: string;
    name: string;
    surname?: string;
    email: string;
    avatar?: string;
    favoriteTeam?: string;
    favoriteSport?: string;
    role?: 'user' | 'bar_owner' | 'admin';
    ownedBars?: string[]; // Array of bar IDs owned by this user
}
