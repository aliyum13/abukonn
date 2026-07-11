// Real-time notification delivery.
//
// Notifications are written to the DB by the various controllers; this pushes
// a lightweight signal to the recipient's socket so their bell badge updates
// immediately instead of only on next page load.
//
// We deliberately emit a *signal*, not the notification body: the client
// refetches its (grouped, deduped) notification list from the API. That keeps
// one source of truth for how notifications are grouped and avoids the client
// having to reimplement that logic.
//
// Emitting is always best-effort — never let a socket problem break the
// request that triggered it.

// Notify a single recipient that they have a new notification.
function emitNotification(app, recipientId) {
  try {
    const io = app && app.get && app.get('io');
    if (!io || !recipientId) return;
    io.to(`user_${recipientId}`).emit('new_notification');
  } catch (err) {
    console.error('emitNotification error:', err.message);
  }
}

// Notify many recipients (e.g. the post fan-out to opted-in followers).
function emitNotificationToMany(app, recipientIds) {
  try {
    const io = app && app.get && app.get('io');
    if (!io || !recipientIds || recipientIds.length === 0) return;
    for (const id of recipientIds) {
      io.to(`user_${id}`).emit('new_notification');
    }
  } catch (err) {
    console.error('emitNotificationToMany error:', err.message);
  }
}

module.exports = { emitNotification, emitNotificationToMany };
