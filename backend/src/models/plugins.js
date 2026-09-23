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
