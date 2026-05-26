import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { SKETCH_THEME } from '../theme/sketchTheme';

interface LoadingIndicatorProps {
    size?: 'small' | 'large' | number;
    style?: any;
    color?: string;
}

export const LoadingIndicator = ({ size = 'small', style, color }: LoadingIndicatorProps) => {
    const spinnerSize: 'small' | 'large' = typeof size === 'number'
        ? (size > 40 ? 'large' : 'small')
        : size;

    return (
        <View style={[styles.container, style]}>
            <ActivityIndicator size={spinnerSize} color={color || SKETCH_THEME.colors.textInverse} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
