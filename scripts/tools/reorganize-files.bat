@echo off
echo Moving files to domain folders...

REM Music Domain
git mv public/music-research.html public/music/
git mv public/album-discovery.html public/music/
git mv public/collection.html public/music/
git mv public/music-time-machine.html public/music/
git mv public/spotify-dashboard.html public/music/
git mv public/spotify-success.html public/music/
git mv public/song-identifier.html public/music/
git mv public/sample-detector.html public/music/
echo Music files moved!

REM Finance Domain
git mv public/encompass-assistant.html public/finance/
echo Finance files moved!

REM Nature Domain
git mv public/tree-discovery.html public/nature/
git mv public/tree-collection.html public/nature/
echo Nature files moved!

REM Family Domain
git mv public/genealogy.html public/family/
git mv public/family-tree.html public/family/
echo Family files moved!

REM AI Domain
git mv public/voice-dj.html public/ai/
git mv public/voice-guide.html public/ai/
git mv public/assistant.html public/ai/
echo AI files moved!

REM Entertainment Domain
git mv public/visualizer.html public/entertainment/
git mv public/player.html public/entertainment/
git mv public/blacklight.html public/entertainment/
git mv public/ouija-board.html public/entertainment/
git mv public/poster-generator.html public/entertainment/
git mv public/art-gallery.html public/entertainment/
git mv public/concert-finder.html public/entertainment/
echo Entertainment files moved!

REM Shared JS/CSS files
git mv public/modern-navbar.js public/shared/
git mv public/user-selector.js public/shared/
git mv public/user-login.js public/shared/
git mv public/user-passwords.js public/shared/
git mv public/voice-widget.js public/shared/
git mv public/dark-mode.js public/shared/
git mv public/quick-actions.js public/shared/
git mv public/scripts.js public/shared/
git mv public/search-history.js public/shared/
git mv public/lineage.js public/shared/
git mv public/calculations.js public/shared/
git mv public/styles.css public/shared/
echo Shared files moved!

echo.
echo All files reorganized successfully!
pause

