# Spin Rhythm XD Request Manager
This is a Firebot script that will manage Custom requests for Spin Rhythm XD (utilizing the SpinShare database).

It was bothering me during streams not having the ability for chat to request the stuff they wanted to hear/see me play/etc. so I wrote a Firebot script that would allow them to do just that. **I'd much rather see a mod that could do this**, rather than something external doing so, but this will do in the meantime.

## Install
Navigate to your Firebot profile's custom scripts directory *(may differ on Windows installations)*, clone the repository and install dependencies:
```
cd /home/theblackparrot/.config/Firebot/v5/profiles/Main Profile/scripts
git clone https://github.com/TheBlackParrot/firebot-srxd-request-manager.git
cd firebot-srxd-request-manager
npm i
```

## Firebot setup
1. In Firebot, navigate to `Settings/Scripts` and enable the `Custom Scripts` option.
2. Create a new command using whichever trigger you please (I use `!srxd`).
3. Add a new "Run Custom Script" effect, click on the "Pick one" dropdown and select `firebot-srxd-request-manager` from the list.
4. Change the Script Options to whatever you see fit.
5. Save changes.

## Updating
1. Navigate to your Firebot profile's custom scripts directory *(may differ on Windows installations)*, and clone the repository again.
```
cd /home/theblackparrot/.config/Firebot/v5/profiles/Main Profile/scripts
git clone https://github.com/TheBlackParrot/firebot-srxd-request-manager.git
```
2. Restart Firebot if it's already running.

## Commands
**[trigger] \#\#\#\# \<diff\>**  
Adds a song into queue *(diff: optional. use this to suggest a difficulty to play)*  

**[trigger] next**  
Grabs the next song in queue, will automatically download if the song data is not present in the Customs folder  

**[trigger] skip**  
Skips the next song in queue  

**[trigger] queue**  
Gives a preview of what's in the queue  

**[trigger] clear**  
Clears the queue  

**[trigger] link**  
Gets a link for the currently playing song, *if it was queued*. 

## TODO
See the TODO tag in this repository's Issue Tracker.