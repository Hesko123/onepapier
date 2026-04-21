import * as Notifications from 'expo-notifications';

export async function requestNotificationPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDeadlineNotification(event) {
  try {
    const eventDate = new Date(event.isoDate + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const daysUntil = Math.round((eventDay - today) / (1000 * 60 * 60 * 24));

    if (daysUntil <= 0) return [];

    let offsets;
    if (daysUntil === 1)       offsets = [0];
    else if (daysUntil <= 6)   offsets = [-1, 0];
    else if (daysUntil <= 29)  offsets = [-3, 0];
    else                       offsets = [-15, -3, 0];

    const bodyFor = {
      0:   "Aujourd'hui",
      '-1':  'Demain',
      '-3':  'Dans 3 jours',
      '-15': 'Dans 15 jours',
    };

    const ids = [];
    for (const offset of offsets) {
      const trigger = new Date(eventDay);
      trigger.setDate(trigger.getDate() + offset);
      trigger.setHours(9, 0, 0, 0);
      if (trigger <= now) continue;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: event.title,
          body: bodyFor[String(offset)],
          data: {},
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger,
        },
      });
      ids.push(id);
    }
    return ids;
  } catch {
    return [];
  }
}

export async function cancelNotifications(notificationIds) {
  if (!notificationIds?.length) return;
  await Promise.all(
    notificationIds.map(id =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );
}
