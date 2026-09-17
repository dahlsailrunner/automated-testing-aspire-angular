using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace CarvedRock.Bff;

// Only used to persist ASP.NET Data Protection keys (which protect the BFF's
// session/auth cookies) so they survive app restarts, matching the pattern in
// D:\demos\fram\ui-with-bff\bff\LocalDbContext.cs.
public class LocalDbContext(DbContextOptions<LocalDbContext> options)
    : DbContext(options), IDataProtectionKeyContext
{
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();
}
