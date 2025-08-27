LearnFrench
LearnFrench is an educational web application designed to help users learn French through YouTube videos with synchronized subtitles. It provides transcriptions in French (with optional phonetic tooltips), translations in multiple languages (e.g., Portuguese and English), real-time subtitle highlighting, a paginated video catalog, a sidebar with suggested videos, synchronized scrolling between transcription panels, and a light/dark theme toggle. The project is built with vanilla JavaScript, HTML5, and Tailwind CSS, avoiding heavy frameworks for a lightweight, standalone experience.
Features

Dynamic Video Loading: Loads videos and their subtitles (SRT files) from a backend API (/api/videos).
Synchronized Subtitles: Displays French transcriptions with optional phonetic tooltips and translations in selected languages (e.g., Portuguese, English).
YouTube Player Integration: Uses the YouTube IFrame API for video playback, with clickable subtitles for seeking.
Real-Time Highlighting: Highlights active subtitles and auto-centers them during playback.
Video Catalog: Paginated catalog with YouTube thumbnails for easy video selection.
Sidebar Suggestions: Displays suggested videos excluding the currently playing one.
Synchronized Scrolling: Syncs scrolling between French and translated transcription panels, with a 4-second timeout to resume auto-centering.
Theming: Light/dark theme toggle persisted via localStorage.
Anki Integration: Allows users to copy subtitle text for Anki flashcards via a modal.
Responsive Design: Optimized for desktop and mobile with Tailwind CSS.

Technologies

Frontend: HTML5, vanilla JavaScript (ES6+), Tailwind CSS
External APIs: YouTube IFrame API for video playback
Dependencies: None (standalone, no npm packages)
Backend: Expects a /api/videos endpoint returning an array of video objects {id: string, title: string, folder: string?} and SRT files in texts/[folder]/*.srt

Project Structure
├── index.html          # Main HTML file
├── css/
│   └── main.css        # Tailwind CSS styles with customizations
├── js/
│   ├── main.js         # Application entry point and state management
│   ├── api.js          # API fetching logic
│   ├── events.js       # Event listeners for UI interactions
│   ├── player.js       # YouTube player initialization and control
│   ├── subtitles.js    # Subtitle parsing and display logic
│   └── utils/
│       └── utils.js    # Utility functions (fetchWithRetry, truncateTitle)
├── texts/
│   └── [videoId]/      # Folder per video containing SRT files
│       ├── original.fr.srt  # French subtitles
│       ├── phonetic.fr.srt  # Phonetic transcriptions (optional)
│       ├── pt.srt          # Portuguese translations
│       └── en.srt          # English translations

Setup Instructions

Clone the Repository:
git clone https://github.com/your-username/learnfrench.git
cd learnfrench


Set Up a Backend Server:

Configure a server to serve the project files and provide a /api/videos endpoint.
The endpoint should return an array of objects: [{id: "youtube_video_id", title: "Video Title", folder: "videoId"}].
Place SRT files in texts/[videoId]/ with filenames original.fr.srt, phonetic.fr.srt (optional), pt.srt, and en.srt.


Serve the Application:

Use a simple HTTP server (e.g., Python's http.server):python3 -m http.server 8000


Access the app at http://localhost:8000.


Dependencies:

No npm packages are required; the project is standalone.
The YouTube IFrame API is loaded dynamically from https://www.youtube.com/iframe_api.


File Requirements:

Ensure SRT files are properly formatted and placed in the texts/[videoId]/ directory.
The backend must serve the texts/ directory and /api/videos endpoint.



Usage

Select a Video: Browse the paginated catalog or sidebar to choose a video.
Interact with Subtitles: Click on a subtitle to seek to that point in the video. Use the [P] toggle for phonetic tooltips.
Change Language: Use the dropdown to switch between translation languages (e.g., Portuguese, English).
Toggle Theme: Click the theme button to switch between light and dark modes.
Anki Modal: Click the card icon next to a subtitle to open the Anki modal and copy text for flashcards.

–
Limitations

No support for npm package installation; the project is fully standalone.
Requires a configured backend for /api/videos and SRT file serving.
Phonetic SRT files (phonetic.fr.srt) are optional; missing files are handled gracefully.
Tested primarily with modern browsers; ensure compatibility with your target audience.

Contributing

Fork the repository.
Create a new branch (git checkout -b feature/your-feature).
Make your changes and commit (git commit -m 'Add your feature').
Push to the branch (git push origin feature/your-feature).
Open a pull request.

License
MIT License. See LICENSE for details.
Acknowledgments

Built with Tailwind CSS for styling.
Powered by the YouTube IFrame API.
Inspired by language learning tools like Anki and subtitle-based learning platforms.
