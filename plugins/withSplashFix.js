const { withDangerousMod } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

// Android Vector Drawable — scales perfectly, no bitmap cropping issues.
// Paper scaled to 40% around center (512,512) so corners stay within any Samsung splash circle mask.
const VECTOR_DRAWABLE = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="1024"
    android:viewportHeight="1024">
    <group
        android:pivotX="512"
        android:pivotY="512"
        android:scaleX="0.40"
        android:scaleY="0.40">
        <path
            android:pathData="M 184 143 L 716 143 L 839 266 L 839 471 L 757 511 L 685 450 L 614 511 L 532 461 L 450 522 L 368 461 L 276 511 L 184 471 Z"
            android:fillColor="#FFFFFF"/>
        <path
            android:pathData="M 716 143 L 839 266 L 716 266 Z"
            android:fillColor="#888780"/>
        <path
            android:pathData="M 184 553 L 276 614 L 368 532 L 450 593 L 532 543 L 614 583 L 685 532 L 757 583 L 839 543 L 839 881 L 184 881 Z"
            android:fillColor="#FFFFFF"/>
    </group>
</vector>`;

// Adaptive icon XML pointing to our vector drawable
const ADAPTIVE_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/splashscreen_background"/>
    <foreground android:drawable="@drawable/splash_fg_custom"/>
</adaptive-icon>
`;

module.exports = function withSplashFix(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const resDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');

      // Override splash XML for Android 12+ (anydpi wins over v31 density-specific)
      const v31Dir = path.join(resDir, 'drawable-anydpi-v31');
      fs.mkdirSync(v31Dir, { recursive: true });
      fs.writeFileSync(path.join(v31Dir, 'splashscreen_logo.xml'), ADAPTIVE_XML);

      // Write vector drawable (single file, no density variants needed)
      const drawableDir = path.join(resDir, 'drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(path.join(drawableDir, 'splash_fg_custom.xml'), VECTOR_DRAWABLE);

      return cfg;
    },
  ]);
};
