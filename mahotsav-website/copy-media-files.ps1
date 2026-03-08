# Instructions to copy media files

# 1. Copy the main map image
Copy-Item "C:\Users\aaksh\OneDrive\Desktop\4\Mahotsav-26 _ Locations Map_8 x 5 copy.jpg.jpeg" -Destination "C:\Users\aaksh\OneDrive\Desktop\4\mahotsav-website\public\map.jpeg"

# 2. Create A-block folder structure
New-Item -ItemType Directory -Path "C:\Users\aaksh\OneDrive\Desktop\4\mahotsav-website\public\a-block\labs" -Force
New-Item -ItemType Directory -Path "C:\Users\aaksh\OneDrive\Desktop\4\mahotsav-website\public\a-block\classrooms" -Force

# 3. Copy A-block image
Copy-Item "C:\Users\aaksh\OneDrive\Desktop\4\A-block\ablock.jpg" -Destination "C:\Users\aaksh\OneDrive\Desktop\4\mahotsav-website\public\a-block\ablock.jpg"

# 4. Copy labs video
Copy-Item "C:\Users\aaksh\OneDrive\Desktop\4\A-block\labs\WhatsApp Video 2026-03-07 at 4.51.57 PM.mp4" -Destination "C:\Users\aaksh\OneDrive\Desktop\4\mahotsav-website\public\a-block\labs\video.mp4"

# 5. Copy classrooms video
Copy-Item "C:\Users\aaksh\OneDrive\Desktop\4\A-block\classrooms\WhatsApp Video 2026-03-07 at 4.51.57 PM.mp4" -Destination "C:\Users\aaksh\OneDrive\Desktop\4\mahotsav-website\public\a-block\classrooms\video.mp4"

Write-Host "Media files copied successfully!" -ForegroundColor Green
