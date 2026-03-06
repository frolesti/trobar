import React, { Component, ErrorInfo } from 'react';
import { View, Text, TouchableOpacity, Platform, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SKETCH_THEME, sketchShadow, ensureLoraOnWeb } from '../theme/sketchTheme';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * ErrorBoundary global — captura errors de renderitzat i mostra
 * una pantalla amigable en comptes d'una pantalla en blanc/crash.
 *
 * Només captura errors de renderitzat (render, lifecycle, constructors de fills).
 * NO captura: event handlers, codi asíncron, errors del propi ErrorBoundary.
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log to console (could send to Sentry/Crashlytics in production)
        console.error('[ErrorBoundary] Uncaught error:', error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }

    componentDidMount() {
        ensureLoraOnWeb();
    }

    handleReload = () => {
        if (Platform.OS === 'web') {
            window.location.href = '/';
        } else {
            // On native, reset the error state to re-render the app tree
            this.setState({ hasError: false, error: null });
        }
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <View style={{
                flex: 1,
                backgroundColor: SKETCH_THEME.colors.bg,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 32,
            }}>
                {/* Icon */}
                <View style={{
                    width: 80, height: 80, borderRadius: 40,
                    backgroundColor: 'rgba(211, 47, 47, 0.1)',
                    justifyContent: 'center', alignItems: 'center',
                    marginBottom: 24,
                }}>
                    <Feather name="alert-triangle" size={40} color="#D32F2F" />
                </View>

                {/* Title */}
                <Text style={{
                    fontSize: 24, fontWeight: 'bold',
                    fontFamily: 'Lora', color: SKETCH_THEME.colors.text,
                    marginBottom: 12, textAlign: 'center',
                }}>
                    Alguna cosa ha anat malament
                </Text>

                {/* Subtitle */}
                <Text style={{
                    fontSize: 15, color: SKETCH_THEME.colors.textMuted,
                    fontFamily: 'Lora', textAlign: 'center',
                    marginBottom: 32, lineHeight: 22,
                }}>
                    L'aplicació ha trobat un error inesperat.{'\n'}
                    Disculpa les molèsties!
                </Text>

                {/* Reload button */}
                <TouchableOpacity
                    onPress={this.handleReload}
                    style={{
                        backgroundColor: SKETCH_THEME.colors.primary,
                        paddingVertical: 14, paddingHorizontal: 32,
                        borderRadius: 12,
                        flexDirection: 'row', alignItems: 'center',
                        ...sketchShadow(),
                    }}
                >
                    <Feather name="refresh-cw" size={18} color="white" style={{ marginRight: 8 }} />
                    <Text style={{
                        color: 'white', fontWeight: 'bold',
                        fontSize: 16, fontFamily: 'Lora',
                    }}>
                        Tornar a l'inici
                    </Text>
                </TouchableOpacity>

                {/* Error detail (dev only, subtle) */}
                {__DEV__ && this.state.error && (
                    <View style={{
                        marginTop: 32, padding: 12,
                        backgroundColor: 'rgba(0,0,0,0.04)',
                        borderRadius: 8, maxWidth: 400, width: '100%',
                    }}>
                        <Text style={{
                            fontSize: 11, color: SKETCH_THEME.colors.textMuted,
                            fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
                        }}>
                            {this.state.error.toString()}
                        </Text>
                    </View>
                )}
            </View>
        );
    }
}

export default ErrorBoundary;
