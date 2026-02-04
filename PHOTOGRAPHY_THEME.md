# Photography Theme Guide

This is a simple, clean photography theme for Hugo. It displays photos in a grid layout on the homepage and individual photo pages.

## How to Add Photos

1. Create a new folder in `content/photos/` for each photo (e.g., `content/photos/my-photo/`)
2. Add your image file to that folder (name it `image.jpg`, `image.png`, etc.)
3. Create a `index.md` file in that folder with frontmatter:

```markdown
+++
title = 'My Photo Title'
date = 2024-01-14T07:07:07+01:00
draft = false
+++

Your photo description goes here. You can use markdown formatting.
```

## Alternative: Using a Single File

You can also create a single markdown file in `content/photos/` (e.g., `my-photo.md`) and reference an image:

```markdown
+++
title = 'My Photo Title'
date = 2024-01-14T07:07:07+01:00
draft = false
image = '/images/my-photo.jpg'
+++

Your photo description goes here.
```

## Structure

- **Homepage**: Shows a grid of all photos from `content/photos/`
- **Photo Page**: Clicking a photo shows it large with title and description below
- **Navigation**: "Back to Gallery" link on each photo page

## Customization

- Edit `static/css/photography.css` to customize styles
- Edit `layouts/_default/baseof.html` to modify the site structure
- Edit `layouts/index.html` or `layouts/_default/list.html` to change the grid layout
- Edit `layouts/_default/single.html` to modify individual photo pages

