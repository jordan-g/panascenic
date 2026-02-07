const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { exec, spawn } = require('child_process');
const convert = require('heic-convert');
const sharp = require('sharp');
const exifr = require('exifr');

const app = express();
const PORT = 3001;

// Debounce timer for Hugo restart
let hugoRestartTimer = null;
const HUGO_RESTART_DEBOUNCE_MS = 2000; // Wait 2 seconds after last upload before restarting

// Thumbnail max dimension (will preserve crop aspect ratio)
const THUMBNAIL_MAX_SIZE = 600;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'content', 'photos', 'temp');
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'image' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|png|gif|webp|heic|heif/;
  const allowedMimes = /jpeg|jpg|png|gif|webp|heic|heif/;
  const extname = allowedExts.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedMimes.test(file.mimetype) || file.mimetype === 'image/heic' || file.mimetype === 'image/heif';
  
  if (extname || mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: fileFilter
});

// Multi-file upload configuration for edit endpoint (main photo + dark mode photo)
const uploadFields = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: fileFilter
}).fields([
  { name: 'photo', maxCount: 1 },
  { name: 'darkModePhoto', maxCount: 1 }
]);

// Helper function to convert HEIC to JPEG
async function convertHeicToJpeg(inputPath) {
  const inputBuffer = await fs.readFile(inputPath);
  const outputBuffer = await convert({
    buffer: inputBuffer,
    format: 'JPEG',
    quality: 0.92
  });
  
  const outputPath = inputPath.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
  await fs.writeFile(outputPath, outputBuffer);
  
  // Remove original HEIC file
  if (outputPath !== inputPath) {
    await fs.remove(inputPath);
  }
  
  return outputPath;
}

// Check if file is HEIC
function isHeicFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.heic' || ext === '.heif';
}

// Extract EXIF metadata (camera and date taken) from an image file
async function extractExifMetadata(filePath) {
  try {
    const exif = await exifr.parse(filePath, {
      pick: ['Make', 'Model', 'DateTimeOriginal', 'CreateDate', 'ModifyDate']
    });
    
    if (!exif) return {};
    
    const result = {};
    
    // Build camera string from Make and Model
    if (exif.Make || exif.Model) {
      const make = (exif.Make || '').trim();
      const model = (exif.Model || '').trim();
      
      if (make && model) {
        // Avoid duplication if model already includes the make (e.g. "Apple iPhone 11 Pro Max")
        if (model.toLowerCase().startsWith(make.toLowerCase())) {
          result.camera = model;
        } else {
          result.camera = `${make} ${model}`;
        }
      } else {
        result.camera = make || model;
      }
    }
    
    // Extract date taken (prefer DateTimeOriginal, fall back to CreateDate, then ModifyDate)
    const dateTaken = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate;
    if (dateTaken) {
      // Format as YYYY-MM-DD
      const d = new Date(dateTaken);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        result.photoDate = `${year}-${month}-${day}`;
      }
    }
    
    return result;
  } catch (error) {
    console.warn('Could not extract EXIF metadata:', error.message);
    return {};
  }
}

// Middleware
app.use(express.json());
app.use(express.static('editor'));
// Serve photos from content/photos directory
app.use('/photos', express.static(path.join(__dirname, 'content', 'photos')));
// Serve static assets (e.g. favicon) for editor preview
app.use(express.static(path.join(__dirname, 'static')));

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Helper function to create slug from title or date
function createSlug(title) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  // Add millisecond timestamp + random to guarantee uniqueness in batch uploads
  const uniqueSuffix = now.getTime().toString(36) + Math.random().toString(36).slice(2, 6);
  
  if (!title || title.trim() === '') {
    // Use timestamp-based slug with unique suffix when no title
    return `${timestamp}-${uniqueSuffix}`;
  }
  
  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  // Append unique suffix to allow duplicate titles
  return `${baseSlug}-${uniqueSuffix}`;
}

// Helper function to restart Hugo server
let hugoProcess = null;

function findHugoProcess() {
  return new Promise((resolve) => {
    exec('pgrep -f "hugo server"', (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve(null);
      } else {
        resolve(stdout.trim().split('\n')[0]);
      }
    });
  });
}

// Debounced Hugo restart - waits for uploads to finish before restarting
function debouncedHugoRestart() {
  if (hugoRestartTimer) {
    clearTimeout(hugoRestartTimer);
  }
  hugoRestartTimer = setTimeout(() => {
    hugoRestartTimer = null;
    restartHugoServer().catch(error => {
      console.error('Error restarting Hugo server:', error);
    });
  }, HUGO_RESTART_DEBOUNCE_MS);
}

function restartHugoServer() {
  return new Promise(async (resolve, reject) => {
    try {
      // Find and kill existing Hugo processes
      const pid = await findHugoProcess();
      if (pid) {
        try {
          process.kill(pid, 'SIGTERM');
          console.log(`Killed existing Hugo process (PID: ${pid})`);
          // Wait a moment for process to terminate
          await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
          console.warn('Could not kill existing Hugo process:', err.message);
        }
      }

      // Kill our tracked process if it exists
      if (hugoProcess) {
        hugoProcess.kill();
        hugoProcess = null;
      }

      // Start new Hugo server
      const hugoArgs = ['server', '--bind', '0.0.0.0', '--port', '1313'];
      hugoProcess = spawn('hugo', hugoArgs, { 
        cwd: __dirname,
        stdio: 'pipe',
        detached: false
      });

      hugoProcess.stdout.on('data', (data) => {
        console.log(`Hugo: ${data}`);
      });

      hugoProcess.stderr.on('data', (data) => {
        console.error(`Hugo error: ${data}`);
      });

      hugoProcess.on('error', (error) => {
        console.error('Failed to start Hugo server:', error);
        reject(error);
      });

      // Wait a bit for server to start
      setTimeout(() => {
        console.log('Hugo server restarted');
        resolve();
      }, 2000);

    } catch (error) {
      console.error('Error restarting Hugo server:', error);
      reject(error);
    }
  });
}

// Upload endpoint
app.post('/api/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, description, tags } = req.body;
    
    // Title is optional - will use date-based slug if empty

    // Create slug from title (or timestamp if no title)
    const slug = createSlug(title);
    const photoDir = path.join(__dirname, 'content', 'photos', slug);
    
    // Ensure directory exists
    await fs.ensureDir(photoDir);

    // Extract EXIF metadata from the original file (before any conversion that might strip it)
    const exifData = await extractExifMetadata(req.file.path);
    if (exifData.camera) console.log('EXIF camera:', exifData.camera);
    if (exifData.photoDate) console.log('EXIF date taken:', exifData.photoDate);

    // Convert HEIC to JPEG if needed
    let processedFilePath = req.file.path;
    let imageExt = path.extname(req.file.path);
    
    if (isHeicFile(req.file.path)) {
      try {
        console.log('Converting HEIC to JPEG...');
        processedFilePath = await convertHeicToJpeg(req.file.path);
        imageExt = '.jpg';
        console.log('HEIC conversion complete');
      } catch (convError) {
        console.error('HEIC conversion error:', convError);
        await fs.remove(req.file.path);
        return res.status(400).json({ error: 'Failed to convert HEIC file. Please try a different format.' });
      }
    }

    // Move uploaded file to photo directory
    const imageName = 'image' + imageExt;
    const finalImagePath = path.join(photoDir, imageName);
    await fs.move(processedFilePath, finalImagePath);

    // Create markdown file
    const now = new Date();
    const dateStr = now.toISOString();
    const tagsArray = parseTags(tags);
    
    // Build frontmatter - title can be empty
    const frontmatter = {
      title: (title && title.trim()) || '',
      date: dateStr,
      draft: false
    };
    if (tagsArray.length > 0) {
      frontmatter.tags = tagsArray;
    }
    
    // Add EXIF metadata if available
    if (exifData.camera) {
      frontmatter.camera = exifData.camera;
    }
    if (exifData.photoDate) {
      frontmatter.photoDate = exifData.photoDate;
    }
    
    const markdownContent = generateFrontmatter(frontmatter, description || '');

    const markdownPath = path.join(photoDir, 'index.md');
    await fs.writeFile(markdownPath, markdownContent);

    // Schedule Hugo restart (debounced - waits for batch uploads to complete)
    debouncedHugoRestart();

    // Respond immediately
    res.json({ 
      success: true, 
      message: 'Photo uploaded and post created successfully',
      slug: slug
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload photo' });
  }
});

// Helper function to parse TOML frontmatter
function parseFrontmatter(content) {
  const frontmatterRegex = /^\+\+\+\s*\n([\s\S]*?)\n\+\+\+\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  
  const frontmatterText = match[1];
  const body = match[2];
  const frontmatter = {};
  
  let currentTable = null;
  
  // Simple TOML parser for our use case
  frontmatterText.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    // Check for table header (e.g., [thumbnailCrop])
    const tableMatch = trimmed.match(/^\[(\w+)\]$/);
    if (tableMatch) {
      currentTable = tableMatch[1];
      frontmatter[currentTable] = {};
      return;
    }
    
    const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      let value = kvMatch[2].trim();
      
      // Parse the value
      let parsedValue;
      
      // Parse arrays (e.g., tags = ['dog', 'pet'])
      if (value.startsWith('[') && value.endsWith(']')) {
        const arrayContent = value.slice(1, -1);
        const items = [];
        // Match items in array (handles both single and double quotes)
        const itemRegex = /['"]([^'"]*)['"]/g;
        let itemMatch;
        while ((itemMatch = itemRegex.exec(arrayContent)) !== null) {
          items.push(itemMatch[1]);
        }
        parsedValue = items;
      }
      // Remove quotes if present
      else if ((value.startsWith("'") && value.endsWith("'")) || 
          (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
        // Unescape single quotes
        value = value.replace(/''/g, "'");
        parsedValue = value;
      }
      // Parse dates
      else if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
        parsedValue = value;
      } else if (value === 'true' || value === 'false') {
        parsedValue = value === 'true';
      } else if (!isNaN(parseFloat(value))) {
        // Parse numbers
        parsedValue = parseFloat(value);
      } else {
        parsedValue = value;
      }
      
      // Add to current table or root
      if (currentTable) {
        frontmatter[currentTable][key] = parsedValue;
      } else {
        frontmatter[key] = parsedValue;
      }
    }
  });
  
  return { frontmatter, body };
}

// Helper function to generate frontmatter string
function generateFrontmatter(frontmatter, body) {
  let result = '+++\n';
  let tables = []; // Store tables to add at the end
  
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      // Handle arrays (e.g., tags)
      if (value.length > 0) {
        const items = value.map(item => {
          const escaped = item.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          return `"${escaped}"`;
        }).join(', ');
        result += `${key} = [${items}]\n`;
      }
    } else if (typeof value === 'boolean') {
      result += `${key} = ${value}\n`;
    } else if (typeof value === 'string') {
      // Use double-quoted strings and escape backslashes and double quotes
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      result += `${key} = "${escaped}"\n`;
    } else if (typeof value === 'object' && value !== null) {
      // Handle nested objects as TOML tables
      let tableStr = `\n[${key}]\n`;
      for (const [subKey, subValue] of Object.entries(value)) {
        if (typeof subValue === 'number') {
          tableStr += `${subKey} = ${subValue}\n`;
        } else if (typeof subValue === 'boolean') {
          tableStr += `${subKey} = ${subValue}\n`;
        } else if (typeof subValue === 'string') {
          const escaped = subValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          tableStr += `${subKey} = "${escaped}"\n`;
        }
      }
      tables.push(tableStr);
    } else if (typeof value === 'number') {
      result += `${key} = ${value}\n`;
    } else {
      result += `${key} = ${value}\n`;
    }
  }
  
  // Add tables at the end
  result += tables.join('');
  
  result += '+++\n\n';
  if (body) {
    result += body;
  }
  return result;
}

// Helper function to parse tags from comma-separated string
function parseTags(tagsString) {
  if (!tagsString || tagsString.trim() === '') {
    return [];
  }
  return tagsString
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
}

// Helper function to find image file in directory
async function findImageFile(dir) {
  const files = await fs.readdir(dir);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    // Skip dark mode, thumbnail, framed, and markdown files
    if (imageExtensions.includes(ext) && 
        !file.startsWith('image-dark') && 
        !file.startsWith('thumbnail') &&
        !file.startsWith('image-framed') &&
        file !== 'index.md') {
      return file;
    }
  }
  return null;
}

// Helper function to find dark mode image file
async function findDarkModeImage(dir) {
  const files = await fs.readdir(dir);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (imageExtensions.includes(ext) && file.startsWith('image-dark')) {
      return file;
    }
  }
  return null;
}

// Helper function to find custom thumbnail
async function findThumbnailFile(dir) {
  const files = await fs.readdir(dir);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (imageExtensions.includes(ext) && file.startsWith('thumbnail')) {
      return file;
    }
  }
  return null;
}

// Generate framed image with border baked in
async function generateFramedImage(imagePath, outputPath, frameData) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    // Parse frame color to RGB
    const hexColor = frameData.color || '#FFFFFF';
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Calculate border size based on inset percentage
    // Use the smaller dimension to calculate border size for consistency
    const minDimension = Math.min(metadata.width, metadata.height);
    const insetPercent = (frameData.insetWidth || 10) / 100;
    const borderSize = Math.round(minDimension * insetPercent * 0.15); // Scale factor for reasonable border
    
    let pipeline = sharp(imagePath);
    
    if (frameData.type === 'even') {
      // Even border on all sides
      pipeline = pipeline.extend({
        top: borderSize,
        bottom: borderSize,
        left: borderSize,
        right: borderSize,
        background: { r, g, b, alpha: 1 }
      });
    } else {
      // Aspect ratio frame - calculate padding to achieve target ratio
      const [targetW, targetH] = frameData.type.split(':').map(Number);
      const targetRatio = targetW / targetH;
      const currentRatio = metadata.width / metadata.height;
      
      let padTop = borderSize;
      let padBottom = borderSize;
      let padLeft = borderSize;
      let padRight = borderSize;
      
      // First add minimum border
      const newWidth = metadata.width + (borderSize * 2);
      const newHeight = metadata.height + (borderSize * 2);
      const newRatio = newWidth / newHeight;
      
      // Then add extra padding to achieve target aspect ratio
      if (newRatio < targetRatio) {
        // Need to add horizontal padding
        const targetWidth = Math.round(newHeight * targetRatio);
        const extraPad = Math.round((targetWidth - newWidth) / 2);
        padLeft += extraPad;
        padRight += extraPad;
      } else if (newRatio > targetRatio) {
        // Need to add vertical padding
        const targetHeight = Math.round(newWidth / targetRatio);
        const extraPad = Math.round((targetHeight - newHeight) / 2);
        padTop += extraPad;
        padBottom += extraPad;
      }
      
      pipeline = pipeline.extend({
        top: padTop,
        bottom: padBottom,
        left: padLeft,
        right: padRight,
        background: { r, g, b, alpha: 1 }
      });
    }
    
    await pipeline.jpeg({ quality: 92 }).toFile(outputPath);
    
    console.log(`Generated framed image: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('Error generating framed image:', error);
    return false;
  }
}

// Helper function to find framed image file
async function findFramedImage(dir) {
  const files = await fs.readdir(dir);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (imageExtensions.includes(ext) && file.startsWith('image-framed')) {
      return file;
    }
  }
  return null;
}

// Generate thumbnail from image with crop data
async function generateThumbnail(imagePath, outputPath, cropData) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    // Calculate crop region in pixels
    const cropX = Math.round(cropData.x * metadata.width);
    const cropY = Math.round(cropData.y * metadata.height);
    const cropW = Math.round(cropData.width * metadata.width);
    const cropH = Math.round(cropData.height * metadata.height);
    
    // Ensure valid crop dimensions
    const safeX = Math.max(0, Math.min(cropX, metadata.width - 1));
    const safeY = Math.max(0, Math.min(cropY, metadata.height - 1));
    const safeW = Math.min(cropW, metadata.width - safeX);
    const safeH = Math.min(cropH, metadata.height - safeY);
    
    // Calculate output dimensions preserving crop aspect ratio
    const cropAspect = safeW / safeH;
    let outputW, outputH;
    
    if (cropAspect > 1) {
      // Wider than tall - constrain by width
      outputW = THUMBNAIL_MAX_SIZE;
      outputH = Math.round(THUMBNAIL_MAX_SIZE / cropAspect);
    } else {
      // Taller than wide - constrain by height
      outputH = THUMBNAIL_MAX_SIZE;
      outputW = Math.round(THUMBNAIL_MAX_SIZE * cropAspect);
    }
    
    await image
      .extract({ left: safeX, top: safeY, width: safeW, height: safeH })
      .resize(outputW, outputH, { fit: 'fill' })
      .jpeg({ quality: 85 })
      .toFile(outputPath);
    
    console.log(`Generated thumbnail: ${outputPath} (${outputW}x${outputH})`);
    return true;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return false;
  }
}

// List all posts
app.get('/api/posts', async (req, res) => {
  try {
    const photosDir = path.join(__dirname, 'content', 'photos');
    const entries = await fs.readdir(photosDir, { withFileTypes: true });
    const posts = [];
    
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'temp') {
        const postDir = path.join(photosDir, entry.name);
        const indexPath = path.join(postDir, 'index.md');
        
        if (await fs.pathExists(indexPath)) {
          const content = await fs.readFile(indexPath, 'utf-8');
          const { frontmatter, body } = parseFrontmatter(content);
          const imageFile = await findImageFile(postDir);
          const darkModeFile = await findDarkModeImage(postDir);
          const thumbnailFile = await findThumbnailFile(postDir);
          const framedFile = await findFramedImage(postDir);
          
          const imagePath = imageFile ? `/photos/${encodeURIComponent(entry.name)}/${encodeURIComponent(imageFile)}` : null;
          const darkModeImagePath = darkModeFile ? `/photos/${encodeURIComponent(entry.name)}/${encodeURIComponent(darkModeFile)}` : null;
          const thumbnailPath = thumbnailFile ? `/photos/${encodeURIComponent(entry.name)}/${encodeURIComponent(thumbnailFile)}` : null;
          const framedImagePath = framedFile ? `/photos/${encodeURIComponent(entry.name)}/${encodeURIComponent(framedFile)}` : null;
          
          posts.push({
            slug: entry.name,
            title: frontmatter.title || '',
            date: frontmatter.date || '',
            photoDate: frontmatter.photoDate || '',
            draft: frontmatter.draft || false,
            tags: frontmatter.tags || [],
            description: body.trim(),
            image: imagePath,
            darkModeImage: darkModeImagePath,
            thumbnail: thumbnailPath,
            thumbnailCrop: frontmatter.thumbnailCrop || null,
            frame: frontmatter.frame || null,
            framedImage: framedImagePath
          });
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Handle markdown files directly in photos directory
        const filePath = path.join(photosDir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        const { frontmatter, body } = parseFrontmatter(content);
        const slug = path.basename(entry.name, '.md');
        
        posts.push({
          slug: slug,
          title: frontmatter.title || '',
          date: frontmatter.date || '',
          photoDate: frontmatter.photoDate || '',
          draft: frontmatter.draft || false,
          tags: frontmatter.tags || [],
          description: body.trim(),
          image: frontmatter.image || null
        });
      }
    }
    
    // Sort by photo date when set, else date created (newest first)
    posts.sort((a, b) => {
      const dateA = new Date(a.photoDate || a.date);
      const dateB = new Date(b.photoDate || b.date);
      return dateB - dateA;
    });
    
    res.json({ posts });
  } catch (error) {
    console.error('Error listing posts:', error);
    res.status(500).json({ error: error.message || 'Failed to list posts' });
  }
});

// Get a specific post
app.get('/api/posts/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const photosDir = path.join(__dirname, 'content', 'photos');
    
    // Try directory first
    const postDir = path.join(photosDir, slug);
    const indexPath = path.join(postDir, 'index.md');
    
    let content, imageFile, darkModeFile, thumbnailFile, framedFile;
    let isDir = false;
    
    if (await fs.pathExists(indexPath)) {
      content = await fs.readFile(indexPath, 'utf-8');
      imageFile = await findImageFile(postDir);
      darkModeFile = await findDarkModeImage(postDir);
      thumbnailFile = await findThumbnailFile(postDir);
      framedFile = await findFramedImage(postDir);
      isDir = true;
    } else {
      // Try markdown file directly
      const filePath = path.join(photosDir, `${slug}.md`);
      if (await fs.pathExists(filePath)) {
        content = await fs.readFile(filePath, 'utf-8');
      } else {
        return res.status(404).json({ error: 'Post not found' });
      }
    }
    
    const { frontmatter, body } = parseFrontmatter(content);
    
    const imagePath = imageFile 
      ? `/photos/${encodeURIComponent(slug)}/${encodeURIComponent(imageFile)}`
      : (frontmatter.image || null);
    
    const darkModeImagePath = darkModeFile
      ? `/photos/${encodeURIComponent(slug)}/${encodeURIComponent(darkModeFile)}`
      : null;
    
    const thumbnailPath = thumbnailFile
      ? `/photos/${encodeURIComponent(slug)}/${encodeURIComponent(thumbnailFile)}`
      : null;
    
    const framedImagePath = framedFile
      ? `/photos/${encodeURIComponent(slug)}/${encodeURIComponent(framedFile)}`
      : null;
    
    res.json({
      slug,
      title: frontmatter.title || '',
      date: frontmatter.date || '',
      draft: frontmatter.draft || false,
      tags: frontmatter.tags || [],
      description: body.trim(),
      image: imagePath,
      darkModeImage: darkModeImagePath,
      thumbnail: thumbnailPath,
      thumbnailCrop: frontmatter.thumbnailCrop || null,
      frame: frontmatter.frame || null,
      framedImage: framedImagePath,
      isDirectory: isDir,
      photoDate: frontmatter.photoDate || '',
      camera: frontmatter.camera || '',
      location: frontmatter.location || null
    });
  } catch (error) {
    console.error('Error getting post:', error);
    res.status(500).json({ error: error.message || 'Failed to get post' });
  }
});

// Update a post (with optional photo upload)
app.put('/api/posts/:slug', uploadFields, async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, description, tags, draft, thumbnailCrop, frame, removeDarkMode, removeThumbnail, photoDate, camera, location, date } = req.body;
    const photoFile = req.files && req.files['photo'] ? req.files['photo'][0] : null;
    const darkModeFile = req.files && req.files['darkModePhoto'] ? req.files['darkModePhoto'][0] : null;
    
    // Title is optional now
    
    const photosDir = path.join(__dirname, 'content', 'photos');
    const postDir = path.join(photosDir, slug);
    const indexPath = path.join(postDir, 'index.md');
    
    let existingContent = '';
    let isDirectory = false;
    
    if (await fs.pathExists(indexPath)) {
      existingContent = await fs.readFile(indexPath, 'utf-8');
      isDirectory = true;
    } else {
      const filePath = path.join(photosDir, `${slug}.md`);
      if (await fs.pathExists(filePath)) {
        existingContent = await fs.readFile(filePath, 'utf-8');
      } else {
        // Clean up uploaded files if present
        if (photoFile) await fs.remove(photoFile.path);
        if (darkModeFile) await fs.remove(darkModeFile.path);
        return res.status(404).json({ error: 'Post not found' });
      }
    }
    
    // Handle main photo replacement if a new photo was uploaded
    if (photoFile && isDirectory) {
      // Convert HEIC to JPEG if needed
      let processedFilePath = photoFile.path;
      let imageExt = path.extname(photoFile.path);
      
      if (isHeicFile(photoFile.path)) {
        try {
          console.log('Converting HEIC to JPEG...');
          processedFilePath = await convertHeicToJpeg(photoFile.path);
          imageExt = '.jpg';
          console.log('HEIC conversion complete');
        } catch (convError) {
          console.error('HEIC conversion error:', convError);
          await fs.remove(photoFile.path);
          if (darkModeFile) await fs.remove(darkModeFile.path);
          return res.status(400).json({ error: 'Failed to convert HEIC file. Please try a different format.' });
        }
      }
      
      // Find and remove old main image files (not dark mode or thumbnail)
      const files = await fs.readdir(postDir);
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (imageExtensions.includes(ext) && 
            !file.startsWith('image-dark') && 
            !file.startsWith('thumbnail') &&
            file !== 'index.md') {
          await fs.remove(path.join(postDir, file));
        }
      }
      
      // Move new image to post directory
      const imageName = 'image' + imageExt;
      const finalImagePath = path.join(postDir, imageName);
      await fs.move(processedFilePath, finalImagePath);
      
      // Remove old thumbnail since image changed
      const oldThumbnail = await findThumbnailFile(postDir);
      if (oldThumbnail) {
        await fs.remove(path.join(postDir, oldThumbnail));
      }
    } else if (photoFile) {
      // If not a directory post, clean up the uploaded file
      await fs.remove(photoFile.path);
    }
    
    // Handle dark mode image
    if (removeDarkMode === 'true' && isDirectory) {
      // Remove dark mode image
      const oldDarkMode = await findDarkModeImage(postDir);
      if (oldDarkMode) {
        await fs.remove(path.join(postDir, oldDarkMode));
        console.log('Removed dark mode image');
      }
    } else if (darkModeFile && isDirectory) {
      // Convert HEIC if needed
      let processedDarkPath = darkModeFile.path;
      let darkExt = path.extname(darkModeFile.path);
      
      if (isHeicFile(darkModeFile.path)) {
        try {
          processedDarkPath = await convertHeicToJpeg(darkModeFile.path);
          darkExt = '.jpg';
        } catch (convError) {
          console.error('HEIC conversion error for dark mode:', convError);
          await fs.remove(darkModeFile.path);
          return res.status(400).json({ error: 'Failed to convert dark mode HEIC file.' });
        }
      }
      
      // Remove old dark mode images
      const files = await fs.readdir(postDir);
      for (const file of files) {
        if (file.startsWith('image-dark')) {
          await fs.remove(path.join(postDir, file));
        }
      }
      
      // Move new dark mode image
      const darkImageName = 'image-dark' + darkExt;
      const finalDarkPath = path.join(postDir, darkImageName);
      await fs.move(processedDarkPath, finalDarkPath);
      console.log('Added dark mode image');
    } else if (darkModeFile) {
      await fs.remove(darkModeFile.path);
    }
    
    const { frontmatter, body: existingBody } = parseFrontmatter(existingContent);
    
    // Update frontmatter - only update if field was provided (for partial updates like inline editing)
    if (title !== undefined) {
      frontmatter.title = title.trim();
    }
    if (draft !== undefined) {
      frontmatter.draft = draft === 'true' || draft === true;
    }
    
    // Update tags
    if (tags !== undefined) {
      const tagsArray = parseTags(tags);
      if (tagsArray.length > 0) {
        frontmatter.tags = tagsArray;
      } else {
        delete frontmatter.tags;
      }
    }
    
    // Update post date (for sorting/display)
    if (date !== undefined) {
      if (date && date.trim()) {
        frontmatter.date = date.trim();
      } else {
        delete frontmatter.date;
      }
    }
    
    // Update photo date (when the photo was taken)
    if (photoDate !== undefined) {
      if (photoDate && photoDate.trim()) {
        frontmatter.photoDate = photoDate.trim();
      } else {
        delete frontmatter.photoDate;
      }
    }
    
    // Update camera
    if (camera !== undefined) {
      if (camera && camera.trim()) {
        frontmatter.camera = camera.trim();
      } else {
        delete frontmatter.camera;
      }
    }
    
    // Update location
    if (location !== undefined) {
      try {
        const locationParsed = location ? JSON.parse(location) : null;
        if (locationParsed && locationParsed.name) {
          frontmatter.location = {
            name: locationParsed.name,
            lat: locationParsed.lat,
            lng: locationParsed.lng
          };
          // Save optional structured address fields if present
          if (locationParsed.placeName) frontmatter.location.placeName = locationParsed.placeName;
          if (locationParsed.city) frontmatter.location.city = locationParsed.city;
          if (locationParsed.state) frontmatter.location.state = locationParsed.state;
          if (locationParsed.country) frontmatter.location.country = locationParsed.country;
        } else {
          delete frontmatter.location;
        }
      } catch (parseError) {
        console.error('Error parsing location data:', parseError);
      }
    }
    
    // Handle thumbnail removal
    if (removeThumbnail === 'true' && isDirectory) {
      delete frontmatter.thumbnailCrop;
      const oldThumbnail = await findThumbnailFile(postDir);
      if (oldThumbnail) {
        await fs.remove(path.join(postDir, oldThumbnail));
        console.log('Removed thumbnail');
      }
    }
    
    // Handle thumbnail crop data
    if (thumbnailCrop && isDirectory) {
      try {
        const cropDataParsed = JSON.parse(thumbnailCrop);
        frontmatter.thumbnailCrop = cropDataParsed;
        
        // Find the main image to generate thumbnail from
        const mainImage = await findImageFile(postDir);
        if (mainImage) {
          const mainImagePath = path.join(postDir, mainImage);
          const thumbnailPath = path.join(postDir, 'thumbnail.jpg');
          
          // Remove old thumbnail if exists
          const oldThumbnail = await findThumbnailFile(postDir);
          if (oldThumbnail && oldThumbnail !== 'thumbnail.jpg') {
            await fs.remove(path.join(postDir, oldThumbnail));
          }
          
          // Generate new thumbnail
          await generateThumbnail(mainImagePath, thumbnailPath, cropDataParsed);
        }
      } catch (parseError) {
        console.error('Error parsing thumbnail crop data:', parseError);
      }
    }
    
    // Handle frame data
    if (frame && isDirectory) {
      try {
        const frameParsed = JSON.parse(frame);
        
        // Remove old framed image first
        const oldFramed = await findFramedImage(postDir);
        if (oldFramed) {
          await fs.remove(path.join(postDir, oldFramed));
          console.log('Removed old framed image');
        }
        
        // Only generate frame if type is not 'none'
        if (frameParsed.type && frameParsed.type !== 'none') {
          frontmatter.frame = frameParsed;
          
          // Generate framed image from original
          const mainImage = await findImageFile(postDir);
          if (mainImage) {
            const mainImagePath = path.join(postDir, mainImage);
            const framedImagePath = path.join(postDir, 'image-framed.jpg');
            await generateFramedImage(mainImagePath, framedImagePath, frameParsed);
          }
        } else {
          // Remove frame from frontmatter if type is 'none'
          delete frontmatter.frame;
        }
      } catch (parseError) {
        console.error('Error parsing frame data:', parseError);
      }
    }
    
    // Generate new content - preserve existing description if not provided (for partial updates)
    const finalDescription = description !== undefined ? description : existingBody;
    const newContent = generateFrontmatter(frontmatter, finalDescription || '');
    
    // Write back
    if (isDirectory) {
      await fs.writeFile(indexPath, newContent);
    } else {
      await fs.writeFile(path.join(photosDir, `${slug}.md`), newContent);
    }
    
    // Restart Hugo server asynchronously (don't wait)
    restartHugoServer().catch(error => {
      console.error('Error restarting Hugo server:', error);
    });
    
    res.json({ success: true, message: 'Post updated successfully' });
  } catch (error) {
    console.error('Error updating post:', error);
    // Clean up uploaded files if present
    if (req.files) {
      try {
        if (req.files['photo']) await fs.remove(req.files['photo'][0].path);
        if (req.files['darkModePhoto']) await fs.remove(req.files['darkModePhoto'][0].path);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded files:', cleanupError);
      }
    }
    res.status(500).json({ error: error.message || 'Failed to update post' });
  }
});

// Delete a post
app.delete('/api/posts/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const photosDir = path.join(__dirname, 'content', 'photos');
    const postDir = path.join(photosDir, slug);
    const indexPath = path.join(postDir, 'index.md');
    
    if (await fs.pathExists(indexPath)) {
      // Delete entire directory
      await fs.remove(postDir);
    } else {
      // Try markdown file
      const filePath = path.join(photosDir, `${slug}.md`);
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      } else {
        return res.status(404).json({ error: 'Post not found' });
      }
    }
    
    // Restart Hugo server asynchronously (don't wait - faster response)
    restartHugoServer().catch(error => {
      console.error('Error restarting Hugo server:', error);
    });
    
    // Respond immediately
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: error.message || 'Failed to delete post' });
  }
});

// Batch delete posts
app.post('/api/posts/batch-delete', express.json(), async (req, res) => {
  try {
    const { slugs } = req.body;
    
    if (!Array.isArray(slugs) || slugs.length === 0) {
      return res.status(400).json({ error: 'No posts specified for deletion' });
    }
    
    const photosDir = path.join(__dirname, 'content', 'photos');
    let deleted = 0;
    let errors = [];
    
    // Delete all specified posts
    for (const slug of slugs) {
      try {
        const postDir = path.join(photosDir, slug);
        const indexPath = path.join(postDir, 'index.md');
        
        if (await fs.pathExists(indexPath)) {
          await fs.remove(postDir);
          deleted++;
        } else {
          const filePath = path.join(photosDir, `${slug}.md`);
          if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
            deleted++;
          } else {
            errors.push(`Post '${slug}' not found`);
          }
        }
      } catch (error) {
        errors.push(`Failed to delete '${slug}': ${error.message}`);
      }
    }
    
    // Restart Hugo server once after all deletions (async)
    restartHugoServer().catch(error => {
      console.error('Error restarting Hugo server:', error);
    });
    
    // Respond immediately with results
    res.json({ 
      success: deleted > 0, 
      deleted,
      total: slugs.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error batch deleting posts:', error);
    res.status(500).json({ error: error.message || 'Failed to delete posts' });
  }
});

// Batch update posts
app.post('/api/posts/batch-update', express.json(), async (req, res) => {
  try {
    const { slugs, updates } = req.body;
    
    if (!Array.isArray(slugs) || slugs.length === 0) {
      return res.status(400).json({ error: 'No posts specified for update' });
    }
    
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'No updates specified' });
    }
    
    const photosDir = path.join(__dirname, 'content', 'photos');
    let updated = 0;
    let errors = [];
    
    // Update all specified posts
    for (const slug of slugs) {
      try {
        const postDir = path.join(photosDir, slug);
        const indexPath = path.join(postDir, 'index.md');
        
        let existingContent = '';
        let isDirectory = false;
        
        if (await fs.pathExists(indexPath)) {
          existingContent = await fs.readFile(indexPath, 'utf-8');
          isDirectory = true;
        } else {
          const filePath = path.join(photosDir, `${slug}.md`);
          if (await fs.pathExists(filePath)) {
            existingContent = await fs.readFile(filePath, 'utf-8');
          } else {
            errors.push(`Post '${slug}' not found`);
            continue;
          }
        }
        
        const { frontmatter, body: existingBody } = parseFrontmatter(existingContent);
        
        // Apply updates - only update fields that are provided and not empty
        if (updates.title !== undefined && updates.title !== '') {
          frontmatter.title = updates.title.trim();
        }
        
        if (updates.description !== undefined && updates.description !== '') {
          // Description will be set as body content
        }
        
        if (updates.photoDate !== undefined && updates.photoDate !== '') {
          frontmatter.photoDate = updates.photoDate.trim();
        }
        
        if (updates.camera !== undefined && updates.camera !== '') {
          frontmatter.camera = updates.camera.trim();
        }
        
        // Handle location data
        if (updates.location !== undefined) {
          try {
            const locationParsed = typeof updates.location === 'string' 
              ? JSON.parse(updates.location) 
              : updates.location;
            if (locationParsed && locationParsed.name) {
              frontmatter.location = {
                name: locationParsed.name,
                lat: locationParsed.lat,
                lng: locationParsed.lng
              };
              // Save optional structured address fields if present
              if (locationParsed.placeName) frontmatter.location.placeName = locationParsed.placeName;
              if (locationParsed.city) frontmatter.location.city = locationParsed.city;
              if (locationParsed.state) frontmatter.location.state = locationParsed.state;
              if (locationParsed.country) frontmatter.location.country = locationParsed.country;
            }
          } catch (parseError) {
            console.error(`Error parsing location data for ${slug}:`, parseError);
          }
        }
        
        // Handle frame data
        if (updates.frame && isDirectory) {
          try {
            const frameParsed = typeof updates.frame === 'string' ? JSON.parse(updates.frame) : updates.frame;
            
            // Remove old framed image first
            const oldFramed = await findFramedImage(postDir);
            if (oldFramed) {
              await fs.remove(path.join(postDir, oldFramed));
            }
            
            // Only generate frame if type is not 'none'
            if (frameParsed.type && frameParsed.type !== 'none') {
              frontmatter.frame = frameParsed;
              
              // Generate framed image from original
              const mainImage = await findImageFile(postDir);
              if (mainImage) {
                const mainImagePath = path.join(postDir, mainImage);
                const framedImagePath = path.join(postDir, 'image-framed.jpg');
                await generateFramedImage(mainImagePath, framedImagePath, frameParsed);
              }
            } else {
              // Remove frame from frontmatter if type is 'none'
              delete frontmatter.frame;
            }
          } catch (parseError) {
            console.error(`Error parsing frame data for ${slug}:`, parseError);
          }
        }
        
        // Generate new content
        const finalDescription = (updates.description !== undefined && updates.description !== '') 
          ? updates.description 
          : existingBody;
        const newContent = generateFrontmatter(frontmatter, finalDescription || '');
        
        // Write back
        if (isDirectory) {
          await fs.writeFile(indexPath, newContent);
        } else {
          await fs.writeFile(path.join(photosDir, `${slug}.md`), newContent);
        }
        
        updated++;
      } catch (error) {
        errors.push(`Failed to update '${slug}': ${error.message}`);
      }
    }
    
    // Restart Hugo server once after all updates (async)
    if (updated > 0) {
      restartHugoServer().catch(error => {
        console.error('Error restarting Hugo server:', error);
      });
    }
    
    // Respond with results
    res.json({ 
      success: updated > 0, 
      updated,
      total: slugs.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error batch updating posts:', error);
    res.status(500).json({ error: error.message || 'Failed to update posts' });
  }
});

// ========== Album API Endpoints ==========

const albumsDataPath = path.join(__dirname, 'data', 'albums.json');
const albumsContentPath = path.join(__dirname, 'content', 'albums');

// Valid album layouts
const ALBUM_LAYOUTS = ['horizontal', 'vertical'];

// Helper function to load albums
async function loadAlbums() {
  try {
    await fs.ensureDir(path.dirname(albumsDataPath));
    if (await fs.pathExists(albumsDataPath)) {
      const data = await fs.readFile(albumsDataPath, 'utf-8');
      return JSON.parse(data);
    }
    return { albums: [] };
  } catch (error) {
    console.error('Error loading albums:', error);
    return { albums: [] };
  }
}

// Helper function to save albums
async function saveAlbums(data) {
  await fs.ensureDir(path.dirname(albumsDataPath));
  await fs.writeFile(albumsDataPath, JSON.stringify(data, null, 2));
}

// Generate unique album ID
function generateAlbumId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Create/update album content page for Hugo
async function syncAlbumContentPage(album) {
  try {
    await fs.ensureDir(albumsContentPath);
    const albumDir = path.join(albumsContentPath, album.id);
    await fs.ensureDir(albumDir);
    
    const frontmatter = {
      title: album.name,
      date: album.createdAt || new Date().toISOString(),
      layout: album.layout || 'horizontal',
      albumId: album.id,
      photoSlugs: album.photoSlugs || []
    };
    
    // Add background colors if set
    if (album.bgColor) {
      frontmatter.bgColor = album.bgColor;
    }
    if (album.bgColorDark) {
      frontmatter.bgColorDark = album.bgColorDark;
    }
    
    const content = generateFrontmatter(frontmatter, album.description || '');
    await fs.writeFile(path.join(albumDir, 'index.md'), content);
    
    console.log(`Synced album content page: ${album.id}`);
  } catch (error) {
    console.error('Error syncing album content page:', error);
  }
}

// Delete album content page
async function deleteAlbumContentPage(albumId) {
  try {
    const albumDir = path.join(albumsContentPath, albumId);
    if (await fs.pathExists(albumDir)) {
      await fs.remove(albumDir);
      console.log(`Deleted album content page: ${albumId}`);
    }
  } catch (error) {
    console.error('Error deleting album content page:', error);
  }
}

// List all albums
app.get('/api/albums', async (req, res) => {
  try {
    const data = await loadAlbums();
    res.json(data);
  } catch (error) {
    console.error('Error listing albums:', error);
    res.status(500).json({ error: 'Failed to list albums' });
  }
});

// Create new album
app.post('/api/albums', async (req, res) => {
  try {
    const { name, description, photoSlugs, layout, thumbnailSlug, stackedPreview, bgColor, bgColorDark } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Album name is required' });
    }
    
    const data = await loadAlbums();
    
    const newAlbum = {
      id: generateAlbumId(),
      name: name.trim(),
      description: (description || '').trim(),
      photoSlugs: photoSlugs || [],
      layout: ALBUM_LAYOUTS.includes(layout) ? layout : 'horizontal',
      thumbnailSlug: thumbnailSlug || null,
      stackedPreview: stackedPreview !== false, // Default to true
      bgColor: bgColor || null,
      bgColorDark: bgColorDark || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    data.albums.push(newAlbum);
    await saveAlbums(data);
    
    // Create Hugo content page for the album
    await syncAlbumContentPage(newAlbum);
    
    // Restart Hugo to pick up new album page
    restartHugoServer().catch(error => {
      console.error('Error restarting Hugo server:', error);
    });
    
    res.json({ success: true, album: newAlbum });
  } catch (error) {
    console.error('Error creating album:', error);
    res.status(500).json({ error: 'Failed to create album' });
  }
});

// Get single album
app.get('/api/albums/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await loadAlbums();
    const album = data.albums.find(a => a.id === id);
    
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }
    
    res.json(album);
  } catch (error) {
    console.error('Error getting album:', error);
    res.status(500).json({ error: 'Failed to get album' });
  }
});

// Update album
app.put('/api/albums/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, photoSlugs, layout, thumbnailSlug, stackedPreview, bgColor, bgColorDark } = req.body;
    
    const data = await loadAlbums();
    const albumIndex = data.albums.findIndex(a => a.id === id);
    
    if (albumIndex === -1) {
      return res.status(404).json({ error: 'Album not found' });
    }
    
    const album = data.albums[albumIndex];
    
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: 'Album name cannot be empty' });
      }
      album.name = name.trim();
    }
    
    if (description !== undefined) {
      album.description = description.trim();
    }
    
    if (photoSlugs !== undefined) {
      album.photoSlugs = photoSlugs;
    }
    
    if (layout !== undefined && ALBUM_LAYOUTS.includes(layout)) {
      album.layout = layout;
    }
    
    // Save thumbnail settings
    if (thumbnailSlug !== undefined) {
      album.thumbnailSlug = thumbnailSlug;
    }
    
    if (stackedPreview !== undefined) {
      album.stackedPreview = stackedPreview;
    }
    
    // Save background color settings
    if (bgColor !== undefined) {
      album.bgColor = bgColor || null;
    }
    
    if (bgColorDark !== undefined) {
      album.bgColorDark = bgColorDark || null;
    }
    
    album.updatedAt = new Date().toISOString();
    
    await saveAlbums(data);
    
    // Update Hugo content page
    await syncAlbumContentPage(album);
    
    // Restart Hugo to pick up changes
    restartHugoServer().catch(error => {
      console.error('Error restarting Hugo server:', error);
    });
    
    res.json({ success: true, album });
  } catch (error) {
    console.error('Error updating album:', error);
    res.status(500).json({ error: 'Failed to update album' });
  }
});

// Delete album
app.delete('/api/albums/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await loadAlbums();
    const albumIndex = data.albums.findIndex(a => a.id === id);
    
    if (albumIndex === -1) {
      return res.status(404).json({ error: 'Album not found' });
    }
    
    data.albums.splice(albumIndex, 1);
    await saveAlbums(data);
    
    // Delete Hugo content page
    await deleteAlbumContentPage(id);
    
    // Restart Hugo to pick up changes
    restartHugoServer().catch(error => {
      console.error('Error restarting Hugo server:', error);
    });
    
    res.json({ success: true, message: 'Album deleted' });
  } catch (error) {
    console.error('Error deleting album:', error);
    res.status(500).json({ error: 'Failed to delete album' });
  }
});

// Add photos to album
app.post('/api/albums/:id/photos', async (req, res) => {
  try {
    const { id } = req.params;
    const { photoSlugs } = req.body;
    
    if (!Array.isArray(photoSlugs)) {
      return res.status(400).json({ error: 'photoSlugs must be an array' });
    }
    
    const data = await loadAlbums();
    const album = data.albums.find(a => a.id === id);
    
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }
    
    // Add new photos (avoid duplicates)
    const existingSlugs = new Set(album.photoSlugs);
    photoSlugs.forEach(slug => existingSlugs.add(slug));
    album.photoSlugs = Array.from(existingSlugs);
    album.updatedAt = new Date().toISOString();
    
    await saveAlbums(data);
    
    // Sync Hugo content page
    await syncAlbumContentPage(album);
    restartHugoServer().catch(error => {
      console.error('Error restarting Hugo server:', error);
    });
    
    res.json({ success: true, album });
  } catch (error) {
    console.error('Error adding photos to album:', error);
    res.status(500).json({ error: 'Failed to add photos to album' });
  }
});

// Remove photos from album
app.delete('/api/albums/:id/photos', async (req, res) => {
  try {
    const { id } = req.params;
    const { photoSlugs } = req.body;
    
    if (!Array.isArray(photoSlugs)) {
      return res.status(400).json({ error: 'photoSlugs must be an array' });
    }
    
    const data = await loadAlbums();
    const album = data.albums.find(a => a.id === id);
    
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }
    
    // Remove specified photos
    const slugsToRemove = new Set(photoSlugs);
    album.photoSlugs = album.photoSlugs.filter(slug => !slugsToRemove.has(slug));
    album.updatedAt = new Date().toISOString();
    
    await saveAlbums(data);
    
    // Sync Hugo content page
    await syncAlbumContentPage(album);
    restartHugoServer().catch(error => {
      console.error('Error restarting Hugo server:', error);
    });
    
    res.json({ success: true, album });
  } catch (error) {
    console.error('Error removing photos from album:', error);
    res.status(500).json({ error: 'Failed to remove photos from album' });
  }
});

// ========== Gallery Order API Endpoints ==========

const galleryOrderPath = path.join(__dirname, 'data', 'galleryOrder.json');

// Get gallery order
app.get('/api/gallery-order', async (req, res) => {
  try {
    await fs.ensureDir(path.dirname(galleryOrderPath));
    if (await fs.pathExists(galleryOrderPath)) {
      const data = await fs.readFile(galleryOrderPath, 'utf-8');
      res.json(JSON.parse(data));
    } else {
      res.json({ order: [] });
    }
  } catch (error) {
    console.error('Error loading gallery order:', error);
    res.status(500).json({ error: 'Failed to load gallery order' });
  }
});

// Save gallery order
app.put('/api/gallery-order', async (req, res) => {
  try {
    const { order } = req.body;
    
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Order must be an array of slugs' });
    }
    
    await fs.ensureDir(path.dirname(galleryOrderPath));
    await fs.writeFile(galleryOrderPath, JSON.stringify({ order }, null, 2));
    
    console.log(`Saved gallery order: ${order.length} photos`);
    
    // Restart Hugo to pick up the new order
    debouncedHugoRestart();
    
    res.json({ success: true, message: 'Gallery order saved' });
  } catch (error) {
    console.error('Error saving gallery order:', error);
    res.status(500).json({ error: 'Failed to save gallery order' });
  }
});

// ========== Highlighted Photos API (gallery featured/pinned, max 5) ==========

const highlightedPhotosPath = path.join(__dirname, 'data', 'highlightedPhotos.json');
const MAX_HIGHLIGHTED = 5;

function normalizeHighlightedItems(parsed) {
  if (Array.isArray(parsed.items)) {
    return parsed.items.slice(0, MAX_HIGHLIGHTED).map((it) => ({
      slug: it.slug,
      sizePercent: typeof it.sizePercent === 'number' ? Math.min(500, Math.max(100, it.sizePercent)) : 200
    }));
  }
  if (Array.isArray(parsed.slugs)) {
    return parsed.slugs.slice(0, MAX_HIGHLIGHTED).map((slug) => ({ slug, sizePercent: 200 }));
  }
  return [];
}

app.get('/api/highlighted-photos', async (req, res) => {
  try {
    await fs.ensureDir(path.dirname(highlightedPhotosPath));
    if (await fs.pathExists(highlightedPhotosPath)) {
      const data = await fs.readFile(highlightedPhotosPath, 'utf-8');
      const parsed = JSON.parse(data);
      const items = normalizeHighlightedItems(parsed);
      res.json({ items });
    } else {
      res.json({ items: [] });
    }
  } catch (error) {
    console.error('Error loading highlighted photos:', error);
    res.status(500).json({ error: 'Failed to load highlighted photos' });
  }
});

app.put('/api/highlighted-photos', async (req, res) => {
  try {
    let { items } = req.body;
    if (Array.isArray(req.body.slugs)) {
      items = req.body.slugs.map((slug) => ({ slug, sizePercent: 200 }));
    }
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array (or slugs for legacy)' });
    }
    const normalized = items.slice(0, MAX_HIGHLIGHTED).map((it) => ({
      slug: it.slug,
      sizePercent: typeof it.sizePercent === 'number' ? Math.min(500, Math.max(100, it.sizePercent)) : 200
    }));
    await fs.ensureDir(path.dirname(highlightedPhotosPath));
    await fs.writeFile(highlightedPhotosPath, JSON.stringify({ items: normalized }, null, 2));
    console.log(`Saved highlighted photos: ${normalized.length}`);
    debouncedHugoRestart();
    res.json({ success: true, items: normalized });
  } catch (error) {
    console.error('Error saving highlighted photos:', error);
    res.status(500).json({ error: 'Failed to save highlighted photos' });
  }
});

// Get site config (e.g. current favicon)
app.get('/api/config', async (req, res) => {
  try {
    const configPath = path.join(__dirname, 'hugo.toml');
    const content = await fs.readFile(configPath, 'utf-8');
    const faviconMatch = content.match(/favicon\s*=\s*["']([^"']+)["']/);
    res.json({ favicon: faviconMatch ? faviconMatch[1] : null });
  } catch (error) {
    console.error('Error reading config:', error);
    res.status(500).json({ error: error.message || 'Failed to read config' });
  }
});

// Create favicon from gallery photo with circular crop
app.post('/api/favicon', express.json(), async (req, res) => {
  try {
    const { slug, crop } = req.body;
    if (!slug || !crop || typeof crop.x !== 'number' || typeof crop.y !== 'number' || typeof crop.width !== 'number' || typeof crop.height !== 'number') {
      return res.status(400).json({ error: 'Missing slug or crop (x, y, width, height as 0–1)' });
    }
    const postDir = path.join(__dirname, 'content', 'photos', slug);
    if (!(await fs.pathExists(postDir))) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    const imageFile = await findImageFile(postDir);
    if (!imageFile) {
      return res.status(400).json({ error: 'No image found for this photo' });
    }
    const imagePath = path.join(postDir, imageFile);
    const metadata = await sharp(imagePath).metadata();
    const w = metadata.width;
    const h = metadata.height;
    const x = Math.round(crop.x * w);
    const y = Math.round(crop.y * h);
    const size = Math.min(Math.round(crop.width * w), Math.round(crop.height * h), w - x, h - y);
    const faviconSize = 64;
    const circleSvg = `<svg width="${faviconSize}" height="${faviconSize}"><circle cx="${faviconSize / 2}" cy="${faviconSize / 2}" r="${faviconSize / 2}" fill="white"/></svg>`;
    const cropped = await sharp(imagePath)
      .extract({ left: x, top: y, width: size, height: size })
      .resize(faviconSize, faviconSize)
      .toBuffer();
    const circleMask = Buffer.from(circleSvg);
    const faviconBuffer = await sharp(cropped)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toBuffer();
    const staticDir = path.join(__dirname, 'static');
    await fs.ensureDir(staticDir);
    const faviconPath = path.join(staticDir, 'favicon.png');
    await fs.writeFile(faviconPath, faviconBuffer);
    const configPath = path.join(__dirname, 'hugo.toml');
    let configContent = await fs.readFile(configPath, 'utf-8');
    if (configContent.match(/favicon\s*=/)) {
      configContent = configContent.replace(/favicon\s*=\s*["'][^"']*["']/, 'favicon = "favicon.png"');
    } else {
      configContent = configContent.replace(/(\[params\]\s*\n)/, '$1favicon = "favicon.png"\n');
    }
    await fs.writeFile(configPath, configContent);
    debouncedHugoRestart();
    res.json({ success: true, favicon: 'favicon.png' });
  } catch (error) {
    console.error('Favicon error:', error);
    res.status(500).json({ error: error.message || 'Failed to create favicon' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Photo editor server running on http://localhost:${PORT}`);
  console.log(`Access the editor at http://localhost:${PORT}`);
  
  // Try to start Hugo server on startup
  restartHugoServer().catch(err => {
    console.warn('Could not start Hugo server automatically:', err.message);
    console.warn('You may need to start it manually with: hugo server');
  });
});

