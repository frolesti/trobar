import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

interface LoadingIndicatorProps {
    size?: 'small' | 'large' | number;
    style?: any;
    color?: string;
}

export const LoadingIndicator = ({ size = 'small', style, color = '#edbb00' }: LoadingIndicatorProps) => {
    const activitySize = (typeof size === 'number' && size > 50) || size === 'large' ? 'large' : 'small';

    return (
        <View style={[styles.container, style]}>
            <ActivityIndicator size={activitySize} color={color} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    }
});
