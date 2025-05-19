// to get a code.Start your development server
// Visit in your browser
// http://localhost:3000/api/dev-tools/set-tier?level=commercial 

// src/app/api/dev-tools/set-tier/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TierLevel } from '../../../context/PremiumContext';

export async function GET(request: NextRequest) {
  // Only work in development environment
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level');
  
  let tierLevel: TierLevel;
  switch (level) {
    case 'free': tierLevel = TierLevel.FREE; break;
    case 'community': tierLevel = TierLevel.COMMUNITY; break;
    case 'commercial': tierLevel = TierLevel.COMMERCIAL; break;
    default: tierLevel = TierLevel.COMMUNITY; // Default
  }
  
  // Generate command to update localStorage
  const jsCommand = `
    localStorage.setItem("intel_aero_tier_level", "${tierLevel}");
    ${tierLevel > 0 ? 
      `localStorage.setItem("intel_aero_tier_expiration", "${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}");` 
      : `localStorage.removeItem("intel_aero_tier_expiration");`
    }
    location.reload();
  `;
  
  // Create a simple page with a button to execute the command
  return new Response(`
    <html>
      <head><title>Set Tier Level</title></head>
      <body style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px;">
        <h1>Development Tier Selector</h1>
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
          <a href="/api/dev-tools/set-tier?level=free" style="padding: 10px 20px; background: #eee; text-decoration: none; border-radius: 4px;">Set FREE</a>
          <a href="/api/dev-tools/set-tier?level=community" style="padding: 10px 20px; background: #ddf; text-decoration: none; border-radius: 4px;">Set COMMUNITY</a>
          <a href="/api/dev-tools/set-tier?level=commercial" style="padding: 10px 20px; background: #dfd; text-decoration: none; border-radius: 4px;">Set COMMERCIAL</a>
        </div>
        <p>Current selection: <strong>${level || 'none'}</strong></p>
        ${level ? `
          <button onclick="applyTier()" style="padding: 10px 20px; background: #06f; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Apply ${level.toUpperCase()} Tier
          </button>
          <p id="status"></p>
          <script>
            function applyTier() {
              try {
                ${jsCommand}
                document.getElementById("status").innerText = "Success! Reloading...";
              } catch(e) {
                document.getElementById("status").innerText = "Error: " + e.message;
              }
            }
          </script>
        ` : ''}
      </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}