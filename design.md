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
