import tracker.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0003_duplicator_replicationlog_datasource_description_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='duplicator',
            name='year_in_service',
            field=models.PositiveIntegerField(default=tracker.models.get_current_year),
        ),
    ]
