import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';

import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import {
  BUILD_TIME_API_BASE,
  getApiBase,
  hasOverride,
  normaliseBase,
  setApiBase,
} from '@/lib/apiBase';
import { formatLongDuration, pluralise } from '@/lib/format';
import { useLibrary } from '@/state/library';

type Probe = { state: 'idle' | 'checking' | 'ok' | 'fail'; message?: string };

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const library = useLibrary();

  const [value, setValue] = useState(getApiBase());
  const [probe, setProbe] = useState<Probe>({ state: 'idle' });
  const [saved, setSaved] = useState(false);
  const [storage, setStorage] = useState<{
    backend: string;
    database: string;
    durable: boolean;
    bucket?: string;
  } | null>(null);

  // Ask the API where uploads actually land, so the durability of someone's
  // music is visible rather than implied.
  useEffect(() => {
    let cancelled = false;
    void api
      .storageStatus()
      .then((result) => {
        if (!cancelled) setStorage(result);
      })
      .catch(() => {
        if (!cancelled) setStorage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [saved]);

  const dirty = normaliseBase(value) !== getApiBase();

  const test = async (candidate?: string) => {
    setProbe({ state: 'checking' });
    const target = normaliseBase(candidate ?? value);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      const response = await fetch(`${target}/api/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) {
        setProbe({ state: 'fail', message: `HTTP ${response.status}` });
        return;
      }
      const body = await response.json();
      setProbe({ state: 'ok', message: `${body.app} v${body.version} · ${body.storage}` });
    } catch (cause) {
      setProbe({
        state: 'fail',
        message: cause instanceof Error ? cause.message : 'Unreachable',
      });
    }
  };

  const save = async () => {
    const normalised = normaliseBase(value);
    if (!normalised) return;
    setApiBase(normalised);
    setValue(normalised);
    setSaved(true);
    await library.refresh();
    await test(normalised);
  };

  const reset = async () => {
    setApiBase(null);
    setValue(BUILD_TIME_API_BASE);
    setSaved(false);
    setProbe({ state: 'idle' });
    await library.refresh();
  };

  const statusColor =
    probe.state === 'ok' ? theme.primary : probe.state === 'fail' ? theme.danger : theme.textSecondary;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Icon name="chevron-down" size={26} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.section, { color: theme.textSecondary }]}>API SERVER</Text>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardText, { color: theme.textSecondary }]}>
            The app talks to the Python API at this address. Everyone you share the link with uses the
            same server, so they see the same library.
          </Text>

          <Input
            value={value}
            onChangeText={(next) => {
              setValue(next);
              setSaved(false);
            }}
            placeholder="https://your-api.onrender.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            rounded={false}
          />

          <View style={styles.buttons}>
            <Pressable
              onPress={() => void test()}
              style={({ pressed }) => [
                styles.button,
                { borderColor: theme.border, backgroundColor: theme.surfaceHigh },
                pressed && styles.pressed,
              ]}>
              {probe.state === 'checking' ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <Icon name="pulse-outline" size={17} />
              )}
              <Text style={[styles.buttonText, { color: theme.text }]}>Test</Text>
            </Pressable>

            <Pressable
              onPress={() => void save()}
              disabled={!dirty}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.primary, opacity: dirty ? 1 : 0.5 },
                pressed && styles.pressed,
              ]}>
              <Icon name="checkmark" size={17} color={theme.onPrimary} />
              <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Save</Text>
            </Pressable>

            {hasOverride() ? (
              <Pressable
                onPress={() => void reset()}
                style={({ pressed }) => [
                  styles.button,
                  { borderColor: theme.border, backgroundColor: theme.surfaceHigh },
                  pressed && styles.pressed,
                ]}>
                <Icon name="refresh" size={17} />
                <Text style={[styles.buttonText, { color: theme.text }]}>Reset</Text>
              </Pressable>
            ) : null}
          </View>

          {probe.state !== 'idle' && probe.state !== 'checking' ? (
            <View style={styles.status}>
              <View style={[styles.dot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{probe.message}</Text>
            </View>
          ) : null}

          {saved ? (
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              Saved. Reload the app if audio still points at the old server.
            </Text>
          ) : null}

          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Built-in default: {BUILD_TIME_API_BASE}
            {hasOverride() ? ' (overridden)' : ''}
          </Text>
        </View>

        <Text style={[styles.section, { color: theme.textSecondary }]}>LIBRARY</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {library.stats ? (
            <View style={styles.statGrid}>
              <Stat label="Tracks" value={String(library.stats.tracks)} />
              <Stat label="Albums" value={String(library.stats.albums)} />
              <Stat label="Artists" value={String(library.stats.artists)} />
              <Stat label="Playlists" value={String(library.stats.playlists)} />
              <Stat label="Total" value={formatLongDuration(library.stats.total_duration)} />
              <Stat label="Plays" value={String(library.stats.total_plays)} />
            </View>
          ) : (
            <Text style={[styles.cardText, { color: theme.textSecondary }]}>
              {pluralise(library.tracks.length, 'track')} loaded.
            </Text>
          )}

          <Pressable
            onPress={() => void library.refresh()}
            style={({ pressed }) => [
              styles.button,
              styles.fullButton,
              { borderColor: theme.border, backgroundColor: theme.surfaceHigh },
              pressed && styles.pressed,
            ]}>
            <Icon name="refresh" size={17} />
            <Text style={[styles.buttonText, { color: theme.text }]}>Reload the library</Text>
          </Pressable>

          {library.error ? (
            <Text style={[styles.statusText, { color: theme.danger }]}>{library.error}</Text>
          ) : null}
        </View>

        <Text style={[styles.section, { color: theme.textSecondary }]}>STORAGE</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.status}>
            <View
              style={[
                styles.dot,
                { backgroundColor: storage?.durable ? theme.primary : theme.danger },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: storage?.durable ? theme.text : theme.danger },
              ]}>
              {storage
                ? storage.durable
                  ? 'Uploads are stored permanently, so they survive a redeploy.'
                  : 'Uploads are temporary: they are erased whenever the server is redeployed.'
                : 'Checking storage…'}
            </Text>
          </View>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Files: {storage?.backend ?? '—'} · Database: {storage?.database ?? '—'}
            {storage?.bucket ? ` · Bucket: ${storage.bucket}` : ''}
          </Text>
        </View>

        <Text style={[styles.section, { color: theme.textSecondary }]}>ABOUT</Text>        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardText, { color: theme.textSecondary }]}>
            OpenBeats · a shared, account-less music library. The demo catalogue contains public-domain
            and Creative Commons recordings streamed from the Internet Archive.
          </Text>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            React Native (Expo) · FastAPI · SQLite · EAS Hosting
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  iconButton: { padding: Spacing.sm, minWidth: 40 },
  body: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  section: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardText: { fontSize: 13.5, lineHeight: 20 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fullButton: { justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '600' },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, flex: 1 },
  hint: { fontSize: 11.5, lineHeight: 17 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  stat: { minWidth: 70 },
  statValue: { fontSize: 19, fontWeight: '700' },
  statLabel: { fontSize: 11.5, marginTop: 1 },
  pressed: { opacity: 0.75 },
});
