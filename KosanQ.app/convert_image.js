const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

// We will use a simple way to 'wrap' the image if we can't find a converter,
// but actually, I will try to use Jimp if possible, or just generate again.
// Since I can't install packages easily without permission, I'll try to find a real PNG artifact.
