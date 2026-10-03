package com.example.whatdidimiss.player

import android.app.Service
import android.content.Intent
import android.os.IBinder

/**
 * Placeholder service. The Fire TV MediaSession is managed in-activity by
 * MediaSessionManager for v1; keeping a declared Service stub so the manifest
 * component exists and can evolve into a MediaSessionService later.
 */
class PlaybackService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null
}
