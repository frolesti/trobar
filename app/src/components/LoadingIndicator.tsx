import React from 'react';
import { Image, View, StyleSheet } from 'react-native';

interface LoadingIndicatorProps {
    size?: 'small' | 'large' | number;
    style?: any;
    color?: string; // Mantingut per compatibilitat però no usat
}

export const LoadingIndicator = ({ size = 'small', style }: LoadingIndicatorProps) => {
    let width = 30; // Mida petita per defecte, adequada per a inline/botons
    
    if (typeof size === 'number') {
        width = size;
    } else if (size === 'large') {
        width = 250; // Augmentat de 100 a 250 tal com es va demanar
    } else if (size === 'small') {
        width = 30;
    }

    return (
        <View style={[styles.container, style]}>
            <Image 
                source={require('../../assets/img/trobar-gif.gif')} 
                style={{ width: width, height: width, resizeMode: 'contain' }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    }
});
