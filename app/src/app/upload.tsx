import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { UploadAsset } from '@/api/client';
import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useLibrary } from '@/state/library';

const MAX_MB = 200;

export default function UploadScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const library = useLibrary();

  const [asset, setAsset] = useState<UploadAsset | null>(null);
  const [sizeBytes, setSizeBytes] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;

      const picked = result.assets[0]!;
      setAsset({
        uri: picked.uri,
        name: picked.name,
        mimeType: picked.mimeType,
        file: (picked as { file?: File }).file ?? null,
      });
      setSizeBytes(picked.size ?? null);
      if (!title && picked.name) {
        setTitle(picked.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim());
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open the file picker.');
    }
  };

  const upload = async () => {
    if (!asset) return;
    setBusy(true);
    setError(null);
    try {
      const created = await library.uploadTrack(asset, { title, artist, album, genre });
      setDone(created.title);
      setAsset(null);
      setTitle('');
      setArtist('');
      setAlbum('');
      setGenre('');
      setSizeBytes(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const prettySize = sizeBytes
    ? sizeBytes > 1048576
      ? `${(sizeBytes / 1048576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
    : null;

  const tooBig = Boolean(sizeBytes && sizeBytes > MAX_MB * 1048576);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Icon name="chevron-down" size={26} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Upload audio</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.dropzone, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Icon name="cloud-upload-outline" size={34} color={theme.primary} />
          <Text style={[styles.dropTitle, { color: theme.text }]}>
            {asset ? (asset.name ?? 'Selected file') : 'Choose an audio file'}
          </Text>
          <Text style={[styles.dropHint, { color: theme.textSecondary }]}>
            MP3, M4A, AAC, FLAC, WAV, OGG or OPUS Â· up to {MAX_MB} MB
          </Text>
          {prettySize ? (
            <Text style={[styles.dropMeta, { color: theme.textMuted }]}>{prettySize}</Text>
          ) : null}

          <Pressable
            onPress={() => void pick()}
            style={({ pressed }) => [
              styles.pickButton,
              { backgroundColor: theme.surfaceHigh, borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <Icon name="folder-open-outline" size={17} />
            <Text style={[styles.pickButtonText, { color: theme.text }]}>
              {asset ? 'Choose a different file' : 'Browse files'}
            </Text>
          </Pressable>

          {Platform.OS === 'web' ? (
            <Text style={[styles.webHint, { color: theme.textMuted }]}>
              Tip: on the web you can also drag a file onto this window.
            </Text>
          ) : null}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          Optional details â€” leave blank to use the file&apos;s own tags
        </Text>

        <Input value={title} onChangeText={setTitle} placeholder="Title" rounded={false} />
        <Input value={artist} onChangeText={setArtist} placeholder="Artist" rounded={false} />
        <Input value={album} onChangeText={setAlbum} placeholder="Album" rounded={false} />
        <Input value={genre} onChangeText={setGenre} placeholder="Genre" rounded={false} />

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
        {done ? (
          <Text style={[styles.success, { color: theme.primary }]}>
            â€œ{done}â€ was added to the shared library ðŸŽ‰
          </Text>
        ) : null}

        <Pressable
          onPress={() => void upload()}
          disabled={!asset || busy || tooBig}
          style={({ pressed }) => [
            styles.uploadButton,
            {
              backgroundColor: theme.primary,
              opacity: !asset || busy || tooBig ? 0.5 : 1,
            },
            pressed && styles.pressed,
          ]}>
          {busy ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <>
              <Icon name="cloud-upload" size={19} color={theme.onPrimary} />
              <Text style={[styles.uploadButtonText, { color: theme.onPrimary }]}>
                Add to library
              </Text>
            </>
          )}
        </Pressable>

        {tooBig ? (
          <Text style={[styles.error, { color: theme.danger }]}>
            That file is larger than {MAX_MB} MB.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  iconButton: {
    padding: Spacing.sm,
    minWidth: 40,
  },
  body: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  dropzone: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: Spacing.sm,
  },
  dropTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  dropHint: {
    fontSize: 12.5,
    textAlign: 'center',
  },
  dropMeta: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    height: 42,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.sm,
  },
  pickButtonText: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  webHint: {
    fontSize: 11.5,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 12.5,
    marginTop: Spacing.sm,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 50,
    borderRadius: Radius.pill,
    marginTop: Spacing.sm,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    fontSize: 13.5,
    textAlign: 'center',
  },
  success: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
