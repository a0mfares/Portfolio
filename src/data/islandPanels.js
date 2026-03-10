/**
 * Static island panel data.
 * Islands 1–5 get their panels from Assets/Data.csv (loaded at runtime).
 * Island 0 (center) and Island 6 (experience) are hardcoded here.
 */
export const STATIC_ISLAND_PANELS = {
  0: [
    {
      notifTitle: 'SYSTEM IDENTITY // ONLINE',
      headerName: 'PROFESSIONAL SUMMARY',
      asset: {
        type: 'text',
        typing: true,
        content:
          'Innovative Software Developer committed to engineering robust, maintainable codebases across diverse platforms. Expert in applying Clean Architecture, MVC, and MVVM patterns to deliver high-quality software using Python, C#, C++, and Dart. combines a strong foundation in operating systems and algorithms with practical experience in leading development teams and mentoring junior developers to drive technological advancement.',
      },
    },
    {
      notifTitle: 'ACADEMIC RECORDS // LOADED',
      headerName: 'EDUCATION',
      asset: {
        type: 'text',
        content:
          'DEGREE    :  Bachelor of Communication and Information\nUNIVERSITY:  University of Science, Technology, Zewail City\nPERIOD    :  Sept 2022 – July 2027 (In Progress)\nSTATUS    :  Undergraduate Student\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n// Zewail City is Egypt\'s premier STEM research university.',
      },
    },
    {
      notifTitle: 'SKILL MATRIX // ACTIVE',
      headerName: 'SKILLS',
      asset: {
        type: 'text',
        content:
          'LANGUAGES : Python, C++, C, C#, Dart, JS, HTML/CSS, SQL, MATLAB\nFRAMEWORKS: ASP.NET Core, Flask, Flutter, Bloc, Riverpod\nARCH      : Clean Arch, MVVM, MVC, SOLID, Design Patterns\nTOOLS     : Git, Linux, SQL Server, Firebase, ffmpeg, yt-dlp\nSOFT SKILL: Leadership, Mentoring, Public Speaking, Curriculum Design',
      },
    },
    {
      notifTitle: 'LANGUAGES // COMMS',
      headerName: 'LANGUAGES',
      asset: {
        type: 'text',
        content: 'ARABIC    : Native Speaker\nENGLISH   : B2 (Upper Intermediate)',
      },
    },
  ],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [
    {
      notifTitle: 'WORK HISTORY // LOG',
      headerName: 'EXPERIENCE',
      asset: {
        type: 'text',
        content:
          '[July 2025 – Oct 2025] App Development Overseer @ Cubble\n// Leading a team, overseeing SDLC, mentoring.\n\n[Apr 2024 – Feb 2025] App Dev Consultant @ Neon Developers\n// Debugging, optimization, Play/App Store compliance.\n\n[Oct/June 2024 – Dec/Sept 2024] Instructor @ Demi Program (iSchool)\n// Teaching programming & AI to students (Code.org, Python).',
      },
    },
    {
      notifTitle: 'LEADERSHIP // GDSC',
      headerName: 'LEADERSHIP & ACTIVITIES',
      asset: {
        type: 'text',
        content:
          '[Sept 2023 – May 2024] Head of App Dev Committee\n// Google Developer Student Club, Zewail City.\n// Mentored teams, organized workshops, designed curriculum.',
      },
    },
  ],
};

/**
 * Parse CSV text into array of row objects.
 */
export function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cols[i] || ''));
    return obj;
  });
}

/**
 * Convert a CSV row to a panel data object.
 * Returns null if row is invalid.
 */
export function csvRowToPanel(row) {
  const islandId = parseInt(row['island']);
  if (isNaN(islandId) || islandId < 1 || islandId > 5) return null;

  const preview =
    row['preview'] && row['preview'].toLowerCase() !== 'null' && row['preview'] !== ''
      ? row['preview']
      : null;
  const link =
    row['link'] && row['link'].toLowerCase() !== 'null' && row['link'] !== ''
      ? row['link']
      : null;
  const name = row['project name'] || 'UNKNOWN PROJECT';

  return {
    islandId,
    data: {
      notifTitle: 'PROJECT // ' + name.toUpperCase(),
      headerName: name.toUpperCase(),
      asset: {
        type: 'project',
        name,
        description: row['description'] || 'No description provided.',
        date: row['date'] || '',
        techStack: row['tech stack'] || '',
        preview,
        link,
      },
    },
  };
}
