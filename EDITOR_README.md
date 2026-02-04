# Photo Editor Interface

A clean web-based interface for uploading photos and creating posts in your Hugo photography site.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the editor server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3001
```

## Usage

1. **Upload a photo**: Click the upload area or drag and drop an image file
2. **Enter title**: Required - this will be used as the post title
3. **Enter description**: Optional - markdown content for the photo description
4. **Submit**: Click "Upload & Create Post" to:
   - Upload the photo to `content/photos/[slug]/`
   - Create a markdown post file
   - Automatically restart the Hugo server

## Features

- Clean, modern interface
- Image preview before upload
- Automatic slug generation from title
- Automatic Hugo server restart
- File validation (images only, 50MB limit)
- Error handling and user feedback

## Requirements

- Node.js (v14 or higher)
- Hugo installed and available in PATH
- Port 3001 available for the editor server
- Port 1313 available for Hugo server

## Notes

- Photos are stored in `content/photos/[slug]/` directories
- Each photo gets an `index.md` file with frontmatter
- The image file is named `image.[ext]` in the photo directory
- Hugo server runs on port 1313 (default)
- The editor server runs on port 3001

