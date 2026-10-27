const { withAndroidManifest } = require('expo/config-plugins');

module.exports = config => withAndroidManifest(config, result => {
    const manifest = result.modResults.manifest;
    manifest.queries ||= [{}];
    const queries = manifest.queries[0];
    queries.intent ||= [];
    for (const scheme of ['google.navigation', 'waze']) {
        if (!queries.intent.some(intent => intent.data?.some(data => data.$?.['android:scheme'] === scheme))) {
            queries.intent.push({ action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }], data: [{ $: { 'android:scheme': scheme } }] });
        }
    }
    return result;
});