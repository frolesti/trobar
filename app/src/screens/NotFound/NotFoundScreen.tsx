import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

/**
 * Pantalla invisible que redirigeix immediatament a Startup.
 * S'activa quan l'usuari accedeix a una ruta web que no existeix.
 */
const NotFoundScreen = () => {
    const navigation = useNavigation<any>();

    useEffect(() => {
        // Redirigeix a l'inici immediatament, substituint la ruta
        navigation.reset({
            index: 0,
            routes: [{ name: 'Startup' }],
        });
    }, []);

    // Mostra una vista buida durant la fracció de segon abans del reset
    return <View style={{ flex: 1 }} />;
};

export default NotFoundScreen;
