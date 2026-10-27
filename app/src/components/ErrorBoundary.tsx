import { EDITORIAL } from '../theme/editorialTheme';
import React, { Component, ErrorInfo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Text from './AppText';
import AppIcon from './AppIcon';
import { SKETCH_THEME, sketchShadow } from '../theme/sketchTheme';

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
        // Registrar a la consola (es podria enviar a Sentry/Crashlytics en producció)
        console.error('[ErrorBoundary] Uncaught error:', error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }

    handleReload = () => {
        // Reiniciar l'estat d'error per re-renderitzar l'arbre de l'app
        this.setState({ hasError: false, error: null });
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
                {/* Icona */}
                <View style={{
                    width: 80, height: 80, borderRadius: 40,
                    backgroundColor: 'rgba(211, 47, 47, 0.1)',
                    justifyContent: 'center', alignItems: 'center',
                    marginBottom: 24,
                }}>
                    <AppIcon name="alert-triangle" size={40} color="#db0030" />
                </View>

                {/* Títol */}
                <Text style={{
                    fontSize: 24, fontWeight: 'bold',
                    fontFamily: EDITORIAL.fontRegular, color: SKETCH_THEME.colors.text,
                    marginBottom: 12, textAlign: 'center',
                }}>
                    Alguna cosa ha anat malament
                </Text>

                {/* Subtítol */}
                <Text style={{
                    fontSize: 16, color: SKETCH_THEME.colors.textMuted,
                    fontFamily: EDITORIAL.fontRegular, textAlign: 'center',
                    marginBottom: 32, lineHeight: 22,
                }}>
                    L'aplicació ha trobat un error inesperat.{'\n'}
                    Disculpa les molèsties!
                </Text>

                {/* Botó de recàrrega */}
                <TouchableOpacity
                    onPress={this.handleReload}
                    style={{
                        backgroundColor: SKETCH_THEME.colors.primary,
                        paddingVertical: 14, paddingHorizontal: 32,
                        borderRadius: 8,
                        flexDirection: 'row', alignItems: 'center',
                        ...sketchShadow(),
                    }}
                >
                    <Text style={{
                        color: 'white', fontWeight: 'bold',
                        fontSize: 16, fontFamily: EDITORIAL.fontRegular,
                    }}>
                        Tornar a l'inici
                    </Text>
                </TouchableOpacity>

                {/* Detall de l'error (només dev, subtil) */}
                {__DEV__ && this.state.error && (
                    <View style={{
                        marginTop: 32, padding: 12,
                        backgroundColor: 'rgba(0,0,0,0.04)',
                        borderRadius: 8, maxWidth: 400, width: '100%',
                    }}>
                        <Text style={{
                            fontSize: 12, color: SKETCH_THEME.colors.textMuted,
                            fontFamily: EDITORIAL.fontRegular,
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
