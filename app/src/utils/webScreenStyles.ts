/**
 * Web-only style helpers to fix the well-known react-native-web flexbox bug
 * where a `flex: 1` View inside React Navigation's stack collapses or expands
 * to its content size (because flex children get `min-height: auto` by
 * default), breaking ScrollView / FlatList scrolling.
 *
 * Usage:
 *   <View style={[styles.container, webScreenContainer]}>
 *     <ScrollView style={[styles.scroll, webScreenScroll]} />
 *   </View>
 *
 * On native both objects are `undefined`, so the existing styles are used as-is.
 *
 * The screen-root `position: absolute` breaks the flex chain coming from
 * React Navigation's screen wrappers (which on web have `flex: 1` but don't
 * forward `min-height: 0`), giving the screen a deterministic full-viewport
 * size so its scrollables can finally overflow.
 */
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

/** Apply to the root View of a screen that contains a scrollable child. */
export const webScreenContainer: any = isWeb
    ? {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
      }
    : undefined;

/** Apply to the ScrollView/FlatList that should fill the remaining space. */
export const webScreenScroll: any = isWeb
    ? {
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
      }
    : undefined;
