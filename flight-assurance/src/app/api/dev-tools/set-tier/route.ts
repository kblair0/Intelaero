// to get a code.Start your development server
// Visit in your browser
// http://localhost:3000/api/dev-tools/set-tier?level=commercial 
// src/app/api/dev-tools/set-tier/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TierLevel } from '../../../types/PremiumTypes'; // Make sure to import from the correct path

export async function GET(request: NextRequest) {
  // Only work in development environment
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level');
  
  // Convert string to numeric enum value
  let tierLevel: number;
  switch (level) {
    case 'free': tierLevel = 0; break;      // TierLevel.FREE
    case 'community': tierLevel = 1; break; // TierLevel.COMMUNITY
    case 'commercial': tierLevel = 2; break; // TierLevel.COMMERCIAL
    default: tierLevel = 0; // Default to FREE
  }
  
  // Generate command to update localStorage with numeric values, not the enum reference
  const jsCommand = `
    localStorage.setItem("intel_aero_tier_level", "${tierLevel}");
    ${tierLevel > 0 ? 
      `localStorage.setItem("intel_aero_tier_expiration", "${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}");` 
      : `localStorage.removeItem("intel_aero_tier_expiration");`
    }
    console.log("Applied tier level:", ${tierLevel});
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
          <a href="/api/dev-tools/set-tier?level=commercial" style="padding: 10px 20px; background: #06f; text-decoration: none; border-radius: 4px;">Set COMMERCIAL</a>
        </div>
        <p>Current selection: <strong>${level || 'none'}</strong> (Tier Level: ${tierLevel})</p>
        <div style="margin-top: 20px; padding: 10px; background: #f8f8f8; border-radius: 4px;">
          <h3>Current localStorage values:</h3>
          <pre id="current-values">Loading...</pre>
        </div>
        ${level ? `
          <button onclick="applyTier()" style="margin-top: 20px; padding: 10px 20px; background: #06f; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Apply ${level.toUpperCase()} Tier (Level ${tierLevel})
          </button>
          <p id="status"></p>
          <script>
            // Display current localStorage values
            document.getElementById("current-values").innerText = JSON.stringify({
              tierLevel: localStorage.getItem("intel_aero_tier_level"),
              expiration: localStorage.getItem("intel_aero_tier_expiration")
            }, null, 2);
            
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
        
        <div style="margin-top: 30px; padding: 10px; background: #fff8e1; border-radius: 4px;">
          <h3>Manual Fix</h3>
          <p>If you're still having issues, open your browser console and run:</p>
          <pre>localStorage.setItem("intel_aero_tier_level", "2"); // For Commercial
localStorage.setItem("intel_aero_tier_expiration", new Date(Date.now() + 365*24*60*60*1000).toISOString());</pre>
          <button onclick="manualFix()" style="margin-top: 10px; padding: 10px 20px; background: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Apply Manual Fix (Commercial)
          </button>
        </div>
        
        <script>
          function manualFix() {
            localStorage.setItem("intel_aero_tier_level", "2"); // Commercial tier
            localStorage.setItem("intel_aero_tier_expiration", new Date(Date.now() + 365*24*60*60*1000).toISOString());
            document.getElementById("current-values").innerText = JSON.stringify({
              tierLevel: localStorage.getItem("intel_aero_tier_level"),
              expiration: localStorage.getItem("intel_aero_tier_expiration")
            }, null, 2);
            alert("Manual fix applied! Click OK to reload.");
            location.reload();
          }
        </script>
      </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}