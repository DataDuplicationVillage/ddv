# Design

This is a CRUD app to keep track of disks for the Defcon Data Duplication Village (DDV).

## Features

* Full web-frontend authentication based on static local username/password database
* Kiosk web-frontend authentication based on scanning disk tags (Disk IDs), which are joined with the DiskHavings entries to find the corresponding DiskHaver ID. Kiosk users then see all diskhavings entries corresponding to their DiskHaver ID.
* Based on Django
* Tracks disk assignments to diskhavers, who make diskhavings entries representing a disk transfer
* Admin users can add, read, modify, and delete all entries in all tables
* Volunteer users can add and modify disks, datasource, diskhavers, and diskhavings entries.
* Regular users can read the diskhavings entries corresponding to their diskhaver ID.
* The Diskhavings table is pushed as a read-only replica to a minimal web frontend. Because the kiosk only needs to look up entries by Disk ID, no other tables are replicated. All other tables are stored on a master host with the full web interface.
* The environment should have four portals; Admin, Volunteer Ops (for intake and return), Processing (to move drives between the various states), and a Status Kiosk that doesn't require authentication - just the Disk Bar Code to provide anyone with the current status of the drive.
* When scanning a provided image, the information identified by the OCR doesn't match the drive details.  If the scan can't clearly identify a component, it should display a notice of what was unable to be captured along with a copy of the picture to the user.  The user can then choose to manually correct or enter the information or to skip entry of the missing data.
