import React, { useEffect, useRef, useState } from 'react';
import { View, Switch, TouchableOpacity } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import Text from './AppText';
import { functions } from '../config/firebase';
import { EDITORIAL } from '../theme/editorialTheme';

export default function BarEmailTips({ demo = false }: { demo?: boolean }) {
    const [enabled, setEnabled] = useState(false);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const pending = useRef(false);
    useEffect(() => {
        if (demo) return;
        let active = true;
        setReady(false);
        const get = httpsCallable<void, { enabled: boolean }>(functions, 'getBarEmailTips');
        get().then(result => {
            if (typeof result.data.enabled !== 'boolean') throw new Error('Invalid email preference');
            if (active) { setEnabled(result.data.enabled); setReady(true); setError(''); }
        }).catch(failure => {
            console.info('[EmailTips] Preference unavailable', failure instanceof Error ? failure.name : 'unknown');
            if (active) setError("No s'ha pogut consultar aquesta preferència.");
        });
        return () => { active = false; };
    }, [demo, attempt]);
    const update = async (value: boolean) => {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        setError('');
        try {
            const save = httpsCallable<{ enabled: boolean }, { enabled: boolean }>(functions, 'setBarEmailTips');
            const result = await save({ enabled: value });
            if (result.data.enabled !== value) throw new Error('Email preference was not confirmed');
            setEnabled(value);
        } catch (failure) {
            console.info('[EmailTips] Cannot save preference', failure instanceof Error ? failure.name : 'unknown');
            setError("No s'ha pogut desar la preferència. Torna-ho a provar.");
        } finally { pending.current = false; setBusy(false); }
    };
    return <View style={{ padding: 16, gap: 8 }}>
        <Text style={{ color: EDITORIAL.ink, fontFamily: EDITORIAL.fontBold }}>Un consell per completar el perfil</Text>
        <Text style={{ color: EDITORIAL.inkMuted, lineHeight: 20 }}>Vull rebre un únic correu d'aquí a 24 hores si al perfil del meu bar encara li falten la descripció, les fotos o els serveis. Puc desactivar-lo aquí o des del mateix correu.</Text>
        <Switch accessibilityLabel="Rebre un únic consell de perfil per correu" value={enabled} disabled={demo || !ready || busy} onValueChange={value => { void update(value); }} trackColor={{ true: EDITORIAL.grana }} />
        {demo && <Text style={{ color: EDITORIAL.inkMuted }}>No disponible al bar de demostració.</Text>}
        {!!error && <Text accessibilityRole="alert" style={{ color: EDITORIAL.grana }}>{error}</Text>}
        {!demo && !ready && !!error && <TouchableOpacity accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: EDITORIAL.grana }}>Tornar-ho a provar</Text></TouchableOpacity>}
    </View>;
}
