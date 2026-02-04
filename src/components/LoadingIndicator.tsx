import React from 'react';
import { Image, View, StyleSheet } from 'react-native';

interface LoadingIndicatorProps {
    size?: 'small' | 'large' | number;
    style?: any;
    color?: string; // Kept for compatibility but unused
}

export const LoadingIndicator = ({ size = 'small', style }: LoadingIndicatorProps) => {
    let width = 30; // Default small appropriate for inline/buttons
    
    if (typeof size === 'number') {
        width = size;
    } else if (size === 'large') {
        width = 250; // Increased from 100 to 250 as requested
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
