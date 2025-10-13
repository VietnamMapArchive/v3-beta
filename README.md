# VMA Map Viewer

The VMA Map Viewer is a web-based application for viewing and interacting with historical maps from the Vietnam Map Archive project. It allows users to overlay historical maps on modern basemaps, add annotations, and create interactive stories.

## Features

*   **Historical Map Overlay**: View historical maps on top of modern basemaps like Esri World Imagery, Google Streets, and Google Satellite.
*   **Multiple View Modes**: Switch between different view modes, including overlay, side-by-side, and spyglass, to compare historical and modern maps.
*   **Annotation Tools**: Add annotations to the maps in the form of points, lines, and polygons. Each annotation can have a title, details, color, and up to two images.
*   **Storytelling**: Create interactive stories by capturing scenes with specific map views, overlays, and visible annotations.
*   **Data Import/Export**: Import and export annotations in CSV or GeoJSON format, and export stories as JSON files.

## Setup

To run the VMA Map Viewer locally, simply open the `index.html` file in a modern web browser. There is no need for a web server or any build process.

## Usage

*   **Basemap Selection**: Use the "Basemap" dropdown to switch between different modern basemaps.
*   **Historical Map Selection**: Choose a historical map from the "Choose Map" dropdown or enter a custom Allmaps ID.
*   **View Mode**: Select a view mode (Overlay, Side X, Side Y, or Spyglass) to compare the historical and modern maps.
*   **Opacity**: Adjust the opacity of the historical map overlay using the slider.
*   **Annotations**:
    *   Use the drawing tools in the "Annotations" panel to add points, lines, or polygons to the map.
    *   Edit annotations by double-clicking on their labels in the table or using the "Edit" button.
    *   Import and export annotations using the "Load" and "Export" buttons.
*   **Stories**:
    *   Capture scenes in the "Story" panel to create a narrative.
    *   Each scene saves the current map view, overlay, and visible annotations.
    *   Present the story as an interactive slideshow.

## Technologies Used

*   [OpenLayers](https://openlayers.org/): A high-performance, feature-packed library for creating interactive maps on the web.
*   [Allmaps](https://allmaps.org/): A set of open-source tools for curating, georeferencing, and exploring historical maps.
*   [Tailwind CSS](https://tailwindcss.com/): A utility-first CSS framework for rapidly building custom designs.
