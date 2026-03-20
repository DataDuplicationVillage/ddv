# Schema

## Disk
* ID -- same as QR code
* DiskModel ID
* Serial number
* Firmware version

## DiskModel
* ID
* Make
* Model
* Capacity INTEGER -- in bytes

## DiskHaver
* ID
* Username
* PasswordHash (or Django Auth User ID)
* Name
* Permission ENUM Admin, Volunteer, User

## DataSource
* ID
* Name

## DiskHavings
* ID
* When DATETIME
* Disk ID
* DiskHaver ID
* HavingsType ENUM give, take, copyready, copysuccess, copyfail, broken
* Datasource ID (Nullable)