const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updatePackages() {
  try {
    // Update packages 4 and 5 to be published
    await prisma.package.updateMany({
      where: {
        id: {
          in: [4, 5]
        }
      },
      data: {
        isPublished: true
      }
    });

    console.log('Packages updated successfully!');
    
    // Check the result
    const packages = await prisma.package.findMany({
      where: {
        id: {
          in: [4, 5]
        }
      },
      select: {
        id: true,
        name: true,
        isPublished: true,
        isActive: true
      }
    });

    console.log('Updated packages:', packages);
  } catch (error) {
    console.error('Error updating packages:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePackages();
