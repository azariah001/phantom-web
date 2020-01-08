# Phantom Web

Phantom Web is a Node.js based web wrapper for [phantom](//github.com/jhead/phantom) by [jhead](//github.com/jhead). Phantom is a server repeater project that allows console players on Xbox and Playstation (note: as per jhead there is no support for Switch at time of publishing) to access custom Bedrock servers (also known as PE on some platforms). Phantom Web was built to a specific spec that allows deployment of Raspberry Pi's as configure, once deploy anywhere, server repeaters. They're great if you're hosting servers for friends and especially helpful if you have a mix of platforms and want an easy solution. What follows are instructions that will allow you to meet the spec that guided the development of this project. The web UI also allows for easy editing and configuration of additional servers by the end user should it become desirable.

#### Familiar UI
![Welcome Page](public/images/screenshots/welcome-page.png)

##### Intuitive controls, just click your server to start/stop the connection.

<div>
  <img src="public/images/screenshots/add-server.png" style="display: inline-block" width="49.5%" />
  <img src="public/images/screenshots/edit-server.png" style="display: inline-block" width="49.5%" />
</div>

## How it works - The Macro

Phantom Web utilises a config.json file to store an array of server configuration objects containing the name, address, port, and auto start status. During startup the server scripts update phantom and then check if any server connections are set to start automatically. In conjunction with adding the server as a system service, this allows total persistence across reboots and power failure tolerance as the file system is only accessed when settings are being loaded or saved, otherwise it all runs in memory.

Once a server is started it's process ID (PID) is stored in memory alongside it's original configuration settings. If the configuration settings are edited while it's running the instance will be automatically restarted with the new settings.

The UI itself is a complete clone of the server configuration tab from the desktop version of the game although it doesn't scale according to screen size, currently, Coming Soon TM. The interface is accessible from port 3000 by default but the guide includes setting an ip tables rule that redirects requests to port 80 to port 3000 so that you don't have to specify the port to access the UI.

## Installation  Guide - TLDR Version

- You will need a Raspberry Pi or a PC running Linux.

- A micro SD card flashed with the latest Ubuntu Server for Arm release.

- And either a bootable live Linux USB drive to set the SSH flag on the micro SD card or a spare HDMI monitor and keyboard.

- Default login credentials for the Ubuntu Server image are ubuntu/ubuntu, set a new password when prompted.

- Update everything and install Node.js and associated tools.

- Clone phantom-web to the home directory.

- Copy the phantom-web.service file to the SystemD service directory.

- Enable the service and setup port forwarding from port 80 to port 3000 to enable easier access to the interface.

- Add your first server.

#### [The long winded version](INSTALL.md)
  
## Deployment

1. Hand Pi to friend with a short network cable, a USB wall wart, and a micro USB cable.
2. Instruct them in the order of operations to connect it to their router.
3. Enjoy!

4. Until they want to add other servers, in which case.
5. Help them find the IP of the Pi.
6. Get them to type the IP into their web browser.
7. And give them a short walk through on how to add new servers.
8. Enjoy!!

## Built With

* [Node.js](https://nodejs.org/en/)

## Authors

* **Azarel Howard** - *Initial work* - [azariah001](https://github.com/azariah001)


## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

This project utilises [phantom](//github.com/jhead/phantom) for the core functionality as an unmodified library which is also licensed under an MIT License.

## Acknowledgments

*  [jhead](//github.com/jhead) for creating [phantom](//github.com/jhead/phantom)
*  [broni_steveoni](https://unsplash.com/@broni_steveoni/collections) for creating such an amazing backdrop image and publishing it on [Unsplash](//unsplash.com)
