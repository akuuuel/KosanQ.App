import React from 'react';
import { NotificationToastRef } from '../components/NotificationToast';

// Use a mutable object so we can update the ref from outside React's lifecycle
let _notificationRef: React.RefObject<NotificationToastRef> | null = null;

/**
 * Called once by RootLayoutNav after the toast component mounts.
 * This avoids using React.createRef() at module level (which is only
 * appropriate for class components).
 */
export const setGlobalNotificationRef = (ref: React.RefObject<NotificationToastRef>) => {
  _notificationRef = ref;
};

export const showInAppNotification = (title: string, message: string, onPress?: () => void) => {
  if (_notificationRef?.current) {
    _notificationRef.current.show(title, message, null, onPress);
  } else {
    console.warn('[NotificationService] Toast ref is not initialized yet.');
  }
};
