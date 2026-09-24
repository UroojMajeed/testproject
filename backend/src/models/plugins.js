import mongoose from 'mongoose';

/**
 * toJSON: _id → id, drop __v, and drop anything the schema marked private.
 * Nothing reaches a client without passing through this.
 */
export function toJSONPlugin(schema) {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform(doc, ret) {
      ret.id = String(ret._id);
      delete ret._id;
      schema.eachPath((path, type) => {
        if (type.options?.private) {
          const parts = path.split('.');
          let node = ret;
          for (let i = 0; i < parts.length - 1 && node; i += 1) node = node[parts[i]];
          if (node) delete node[parts.at(-1)];
        }
      });
      return ret;
    },
  });
}

/** Soft delete: a deletedAt field plus a default filter that hides them. */
export function softDeletePlugin(schema) {
  schema.add({ deletedAt: { type: Date, default: null, index: true } });

  const hide = function hide(next) {
    if (!this.getOptions?.().withDeleted) {
      const q = this.getQuery();
      if (!('deletedAt' in q)) this.where({ deletedAt: null });
    }
    next();
  };
  ['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'updateOne', 'updateMany'].forEach((op) =>
    schema.pre(op, hide),
  );

  schema.methods.softDelete = function softDelete() {
    this.deletedAt = new Date();
    return this.save();
  };
}

/**
 * Tenancy, enforced rather than remembered.
 *
 * Every read and write on a tenant-scoped model must name a workspace. A query
 * that forgets is not a smaller result set — it is one workspace's data handed to
 * another, which is the worst bug this product could have and the quietest.
 * Discipline does not survive the fiftieth query, so this throws instead.
 *
 * The escape hatch is explicit and greppable: `.setOptions({ allTenants: true })`,
 * for the few places that legitimately cross workspaces, such as an admin count.
 */
export function tenantPlugin(schema) {
  schema.add({
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
  });

  const requireWorkspace = function requireWorkspace(next) {
    if (this.getOptions?.().allTenants) return next();

    const query = this.getQuery();
    if (!query.workspaceId) {
      return next(new Error(
        `${this.model.modelName}: every query must carry workspaceId. `
        + 'If this one genuinely spans workspaces, say so with '
        + '.setOptions({ allTenants: true }).',
      ));
    }
    return next();
  };

  ['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'countDocuments',
    'updateOne', 'updateMany', 'deleteOne', 'deleteMany'].forEach((op) =>
    schema.pre(op, requireWorkspace));

  // findById bypasses the hooks above, and "load one row by its id" is exactly
  // where a cross-tenant read slips in. There is no unscoped version.
  schema.statics.findByIdScoped = function findByIdScoped(id, workspaceId) {
    return this.findOne({ _id: id, workspaceId });
  };
}
