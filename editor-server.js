const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { exec, spawn } = require('child_process');
const convert = require('heic-convert');

const app = express();
const PORT = 3001;

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

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedExts = /jpeg|jpg|png|gif|webp|heic|heif/;
    const allowedMimes = /jpeg|jpg|png|gif|webp|heic|heif/;
    const extname = allowedExts.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimes.test(file.mimetype) || file.mimetype === 'image/heic' || file.mimetype === 'image/heif';
    
    if (extname || mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

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

// Middleware
app.use(express.json());
app.use(express.static('editor'));
// Serve photos from content/photos directory
app.use('/photos', express.static(path.join(__dirname, 'content', 'photos')));

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
  
  if (!title || title.trim() === '') {
    // Use timestamp-based slug when no title
    return timestamp;
  }
  
  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  // Append short timestamp to allow duplicate titles
  const shortTimestamp = now.getTime().toString(36);
  return `${baseSlug}-${shortTimestamp}`;
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
    
    const markdownContent = generateFrontmatter(frontmatter, description || '');

    const markdownPath = path.join(photoDir, 'index.md');
    await fs.writeFile(markdownPath, markdownContent);

    // Restart Hugo server asynchronously (don't wait)
    restartHugoServer().catch(error => {
      console.error('Error restarting Hugo server:', error);
    });

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
  
  // Simple TOML parser for our use case
  frontmatterText.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();
      
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
        frontmatter[key] = items;
      }
      // Remove quotes if present
      else if ((value.startsWith("'") && value.endsWith("'")) || 
          (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
        // Unescape single quotes
        value = value.replace(/''/g, "'");
        frontmatter[key] = value;
      }
      // Parse dates
      else if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
        frontmatter[key] = value;
      } else if (value === 'true' || value === 'false') {
        frontmatter[key] = value === 'true';
      } else {
        frontmatter[key] = value;
      }
    }
  });
  
  return { frontmatter, body };
}

// Helper function to generate frontmatter string
function generateFrontmatter(frontmatter, body) {
  let result = '+++\n';
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      // Handle arrays (e.g., tags)
      if (value.length > 0) {
        const items = value.map(item => `'${item.replace(/'/g, "''")}'`).join(', ');
        result += `${key} = [${items}]\n`;
      }
    } else if (typeof value === 'boolean') {
      result += `${key} = ${value}\n`;
    } else if (typeof value === 'string') {
      // Escape single quotes
      const escaped = value.replace(/'/g, "''");
      result += `${key} = '${escaped}'\n`;
    } else {
      result += `${key} = ${value}\n`;
    }
  }
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
    if (imageExtensions.includes(ext) && file !== 'index.md') {
      return file;
    }
  }
  return null;
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
          
          const imagePath = imageFile ? `/photos/${encodeURIComponent(entry.name)}/${encodeURIComponent(imageFile)}` : null;
          posts.push({
            slug: entry.name,
            title: frontmatter.title || '',
            date: frontmatter.date || '',
            draft: frontmatter.draft || false,
            tags: frontmatter.tags || [],
            description: body.trim(),
            image: imagePath
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
          draft: frontmatter.draft || false,
          tags: frontmatter.tags || [],
          description: body.trim(),
          image: frontmatter.image || null
        });
      }
    }
    
    // Sort by date (newest first)
    posts.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
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
    
    let content, imageFile;
    
    if (await fs.pathExists(indexPath)) {
      content = await fs.readFile(indexPath, 'utf-8');
      imageFile = await findImageFile(postDir);
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
    
    res.json({
      slug,
      title: frontmatter.title || '',
      date: frontmatter.date || '',
      draft: frontmatter.draft || false,
      tags: frontmatter.tags || [],
      description: body.trim(),
      image: imagePath,
      isDirectory: await fs.pathExists(indexPath)
    });
  } catch (error) {
    console.error('Error getting post:', error);
    res.status(500).json({ error: error.message || 'Failed to get post' });
  }
});

// Update a post (with optional photo upload)
app.put('/api/posts/:slug', upload.single('photo'), async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, description, tags, draft } = req.body;
    
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
        // Clean up uploaded file if present
        if (req.file) {
          await fs.remove(req.file.path);
        }
        return res.status(404).json({ error: 'Post not found' });
      }
    }
    
    // Handle photo replacement if a new photo was uploaded
    if (req.file && isDirectory) {
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
      
      // Find and remove old image files
      const files = await fs.readdir(postDir);
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (imageExtensions.includes(ext) && file !== 'index.md') {
          await fs.remove(path.join(postDir, file));
        }
      }
      
      // Move new image to post directory
      const imageName = 'image' + imageExt;
      const finalImagePath = path.join(postDir, imageName);
      await fs.move(processedFilePath, finalImagePath);
    } else if (req.file) {
      // If not a directory post, clean up the uploaded file
      await fs.remove(req.file.path);
    }
    
    const { frontmatter } = parseFrontmatter(existingContent);
    
    // Update frontmatter - title can be empty
    frontmatter.title = (title && title.trim()) || '';
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
    
    // Generate new content
    const newContent = generateFrontmatter(frontmatter, description || '');
    
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
    // Clean up uploaded file if present
    if (req.file) {
      try {
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError);
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

