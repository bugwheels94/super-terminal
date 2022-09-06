## Intro

    	[
    		"@semantic-release/exec",
    		{
    			"publishCmd": "mv \"windows-out/zip/win32/x64/Super Terminal-win32-x64-1.0.0.zip\" \"windows-out/Super Terminal-win32-x64-${nextRelease.version}.zip\" && mv \"windows-out/squirrel.windows/x64/Super Terminal-1.0.0 Setup.exe\" \"windows-out/Super Terminal-${nextRelease.version} Setup.exe\""
    		}
    	],
