# PyRemoteChrome

PyRemoteChrome is a server that allows you to control chrome/chromium remotely using urls while watching what is being shown on your browser.

The software uses selenium webdriver to control chrome/chromium and uses ffmpeg to generate http-live-streamming. Audio is included in the stream.

## Features
- [ ] Mouse movement:
  - [x] Left click, right click, double click
  - [x] Scrolling
  - [ ] Dragging and dropping
- [x] Keyboard pressing
- [ ] Controlling windows
  - [x] Changing window size
  - [x] Copy, cut and paste
  - [ ] Select from and click on drop down menu and context menu
  - [ ] Handle pop-ups, prompts, alerts and other dialogues
- [ ] File downloading
- [ ] File uploading
- [ ] Sync cookies
- [ ] Developer Tools
- [x] Ffmpeg screen capturing
  - [x] Linux
  - [ ] Windows
  - [ ] MacOS

## System Requirements

- Linux
  - Ubuntu 22.04
  - Other linux (including Windows WSL) might work, but hasn't been tested.
- Windows and MacOS are not available yet because most applications on them don't start on a X11 display.

## Dependencies
- Ffmpeg
- Pulseaudio, pacmd and pactl
- Xvfb, x11-utils and gnumeric
- Chrome/Chromium
- Webdriver
- Python 3.8+ and dependencies listed in [requirements.txt](https://github.com/Wes-KW/PyRemoteChrome/requirements.txt)

## Installation
1. Install ffmpeg
```shell
$ sudo apt-get install ffmpeg
```

2. Install PulseAudio and start it
```shell
$ sudo apt-get install pulseaudio pulseaudio-utils
$ pulseaudio -D
```

3. Install Xvfb
```shell
$ sudo apt-get install xvfb x11-utils gnumeric
```

4. Install Chromium
```shell
$ sudo apt-get install chromium-browser
```

5. Download chromedriver from [chromedriver official site](https://googlechromelabs.github.io/chrome-for-testing/) and place it into somewhere you can execute
   <br/>
   **Note**: If you want to install Chrome instead, go to [chrome official site](https://www.google.com/chrome/), download it and install it with `$ dpkg -i \path\to\chrome_installer`
6. Install Python3
```shell
$ sudo apt-get install python3.10
```

7. Install PyRemoteChrome with `pip`
```shell
$ python3 -m pip install pyremotechrome
```

8. Add a configuration file, copy the content from [demo.json](https://github.com/Wes-KW/PyRemoteChrome/blob/master/demo.json) and save it as `~/pyremotechrome.config.json`

9. You might want to change your configuration on executable path of chromedriver and python; And also that on ffmpeg so that streaming is not choppy and audio is not rushing or lagging.

10. Start the server
```shell
$ python3 -m pyremotechrome
```

## Getting Started
Here are some examples of how to control chrome/chromium using url
- Open chrome/chromium
```
http://localhost:5777/api?request=pyapi&action=create_session&session_id=example
```
- Navigate to google.com
```
http://localhost:5777/api?request=pyapi&action=get&session_id=example&url=http://www.google.com
```
- Move your mouse to 50 pixels from the left, 100 pixels from the top
```
http://localhost:5777/api?request=pyapi&action=mouse_move&session_id=example&x=50&y=100
```
- Exit the browser
```
http://localhost:5777/api?request=pyapi&action=destory_session&session_id=example
```
- Stream using http-live-streaming

You can write a simple webpage as provided [here (hls.js github repo)](https://github.com/video-dev/hls.js) to play the `*.m3u8` file (usually in `data_dir/video/` where `data_dir` is the directory you set in the configuration file)


## Documentation
Documentation is not ready yet. However...
Most action have the same name as those in selenium. You can take a look into the source code to find out the action names and their parameters.
